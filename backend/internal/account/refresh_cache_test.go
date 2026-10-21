package account_test

import (
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"feedsystem_video_go/internal/account"
	"feedsystem_video_go/internal/auth"
	jwtmiddleware "feedsystem_video_go/internal/middleware/jwt"
	rediscache "feedsystem_video_go/internal/middleware/redis"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	redis "github.com/redis/go-redis/v9"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type refreshCacheHook struct {
	values     map[string]string
	failWrites bool
}

func (h *refreshCacheHook) DialHook(next redis.DialHook) redis.DialHook {
	return func(context.Context, string, string) (net.Conn, error) { return nil, errors.New("network disabled") }
}
func (h *refreshCacheHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, command redis.Cmder) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		args := command.Args()
		key := fmt.Sprint(args[1])
		switch command.Name() {
		case "get":
			if value, ok := h.values[key]; ok {
				command.(*redis.StringCmd).SetVal(value)
				return nil
			}
			return redis.Nil
		case "set":
			if h.failWrites {
				return errors.New("Redis write failed")
			}
			value := fmt.Sprint(args[2])
			if data, ok := args[2].([]byte); ok {
				value = string(data)
			}
			h.values[key] = value
			command.(*redis.StatusCmd).SetVal("OK")
			return nil
		case "del":
			if h.failWrites {
				return errors.New("Redis deletion failed")
			}
			delete(h.values, key)
			command.(*redis.IntCmd).SetVal(1)
			return nil
		}
		return errors.New("unexpected Redis command")
	}
}
func (h *refreshCacheHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(context.Context, []redis.Cmder) error { return errors.New("unexpected pipeline") }
}

type captureToken struct{ token *string }

func (m captureToken) Match(value driver.Value) bool {
	token, ok := value.(string)
	if ok {
		*m.token = token
	}
	return ok && token != ""
}
func refreshDatabase(t *testing.T) (*account.AccountRepository, sqlmock.Sqlmock) {
	t.Helper()
	connection, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { connection.Close() })
	db, err := gorm.Open(mysql.New(mysql.Config{Conn: connection, SkipInitializeWithVersion: true}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Error(err)
		}
	})
	return account.NewAccountRepository(db), mock
}
func accountRows(token string) *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "username", "token", "refresh_token"}).AddRow(42, "tester", token, "valid-refresh")
}
func expectAccountByID(mock sqlmock.Sqlmock, token string) *sqlmock.ExpectedQuery {
	return mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `accounts` WHERE `accounts`.`id` = ? ORDER BY `accounts`.`id` LIMIT ?")).WithArgs(42, 1).WillReturnRows(accountRows(token))
}

func TestRefreshTokenImmediatelyWorksWithJWTMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "refresh-regression-secret")
	for _, tc := range []struct {
		name                       string
		cachedLookup, writeFailure bool
	}{
		{"missing refresh index replaces stale access cache", false, false},
		{"cache hit after slow SQL uses a fresh write deadline", true, false},
		{"stale access cache after failed writes falls back to database", false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repository, mock := refreshDatabase(t)
			hook := &refreshCacheHook{values: map[string]string{"test:account:42": "old-access"}, failWrites: tc.writeFailure}
			if tc.cachedLookup {
				hook.values["test:refresh:valid-refresh"] = "42"
			}
			rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"})
			t.Cleanup(func() { rdb.Close() })
			rdb.AddHook(hook)
			cache := rediscache.NewClient(rdb, "test:")
			if tc.cachedLookup {
				expectAccountByID(mock, "old-access").WillDelayFor(70 * time.Millisecond)
			} else {
				mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `accounts` WHERE refresh_token = ? ORDER BY `accounts`.`id` LIMIT ?")).WithArgs("valid-refresh", 1).WillReturnRows(accountRows("old-access"))
			}
			var savedToken string
			mock.ExpectBegin()
			mock.ExpectExec(regexp.QuoteMeta("UPDATE `accounts` SET `token`=? WHERE id = ?")).WithArgs(captureToken{&savedToken}, 42).WillReturnResult(sqlmock.NewResult(0, 1))
			mock.ExpectCommit()
			handler := account.NewAcountHandler(account.NewAccountService(repository, cache))
			router := gin.New()
			router.POST("/account/refresh", handler.Refresh)
			router.GET("/protected", jwtmiddleware.JWTAuth(repository, cache), func(c *gin.Context) { c.Status(http.StatusOK) })
			request := httptest.NewRequest(http.MethodPost, "/account/refresh", bytes.NewBufferString(`{"refresh_token":"valid-refresh"}`))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("refresh %d: %s", response.Code, response.Body.String())
			}
			var data struct {
				Token     string `json:"token"`
				AccountID uint   `json:"account_id"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &data); err != nil {
				t.Fatal(err)
			}
			if data.Token == "" || data.Token != savedToken || data.AccountID != 42 {
				t.Fatal("refresh did not return the committed access token")
			}
			if claims, err := auth.ParseToken(data.Token); err != nil || claims.AccountID != 42 {
				t.Fatalf("invalid issued JWT: %v", err)
			}
			if !tc.writeFailure {
				if hook.values["test:account:42"] != data.Token || hook.values["test:refresh:valid-refresh"] != "42" || hook.values["test:account:42:refresh"] != "valid-refresh" {
					t.Fatal("refresh caches do not match persisted credentials")
				}
			} else {
				if hook.values["test:account:42"] != "old-access" {
					t.Fatal("test must retain the stale value after failed Redis writes")
				}
				expectAccountByID(mock, savedToken)
				hook.failWrites = false
			}
			protected := httptest.NewRequest(http.MethodGet, "/protected", nil)
			protected.Header.Set("Authorization", "Bearer "+data.Token)
			result := httptest.NewRecorder()
			router.ServeHTTP(result, protected)
			if result.Code != http.StatusOK {
				t.Fatalf("fresh token rejected: %d %s", result.Code, result.Body.String())
			}
			if hook.values["test:account:42"] != data.Token {
				t.Fatal("JWT fallback did not repair stale access cache")
			}
		})
	}
}

func TestJWTCacheMismatchDoesNotRestoreRevokedToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "refresh-regression-secret")
	repository, mock := refreshDatabase(t)
	token, err := auth.GenerateToken(42, "tester")
	if err != nil {
		t.Fatal(err)
	}
	hook := &refreshCacheHook{values: map[string]string{"test:account:42": "cached-current-token"}}
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"})
	t.Cleanup(func() { rdb.Close() })
	rdb.AddHook(hook)
	expectAccountByID(mock, "database-current-token")
	router := gin.New()
	router.GET("/protected", jwtmiddleware.JWTAuth(repository, rediscache.NewClient(rdb, "test:")), func(c *gin.Context) { c.Status(http.StatusOK) })
	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("revoked token accepted: %d", response.Code)
	}
	if hook.values["test:account:42"] != "cached-current-token" {
		t.Fatal("revoked token overwrote cache")
	}
}
