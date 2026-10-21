package account

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func TestUpdateProfileExplicitEmptyAndOmittedFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name    string
		body    string
		columns []string
		values  []interface{}
	}{
		{"clear bio without avatar", `{"bio":""}`, []string{"bio"}, []interface{}{"", uint(42)}},
		{"whitespace bio clears", `{"bio":"  \t "}`, []string{"bio"}, []interface{}{"", uint(42)}},
		{"bio only preserves avatar", `{"bio":"  new bio  "}`, []string{"bio"}, []interface{}{"new bio", uint(42)}},
		{"avatar only preserves bio", `{"avatar_url":" /static/new.png "}`, []string{"avatar_url"}, []interface{}{"/static/new.png", uint(42)}},
		{"legacy payload clears bio", `{"avatar_url":"/static/current.png","bio":""}`, []string{"avatar_url", "bio"}, []interface{}{"/static/current.png", "", uint(42)}},
		{"explicit avatar removal", `{"avatar_url":""}`, []string{"avatar_url"}, []interface{}{"", uint(42)}},
		{"null bio is omitted", `{"avatar_url":"/static/new.png","bio":null}`, []string{"avatar_url"}, []interface{}{"/static/new.png", uint(42)}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			db, err := gorm.Open(mysql.New(mysql.Config{
				DSN:                       "unused:unused@tcp(127.0.0.1:1)/unused",
				SkipInitializeWithVersion: true,
			}), &gorm.Config{DryRun: true, DisableAutomaticPing: true, SkipDefaultTransaction: true})
			if err != nil {
				t.Fatal(err)
			}
			sqlDB, err := db.DB()
			if err != nil {
				t.Fatal(err)
			}
			defer sqlDB.Close()
			var sql string
			var values []interface{}
			if err := db.Callback().Update().After("gorm:update").Register("test:capture-profile-update", func(tx *gorm.DB) {
				sql = tx.Statement.SQL.String()
				values = append([]interface{}(nil), tx.Statement.Vars...)
			}); err != nil {
				t.Fatal(err)
			}
			handler := NewAcountHandler(NewAccountService(NewAccountRepository(db), nil))
			router := gin.New()
			router.POST("/account/profile", func(c *gin.Context) {
				c.Set("accountID", uint(42))
			}, handler.UpdateProfile)
			request := httptest.NewRequest(http.MethodPost, "/account/profile", bytes.NewBufferString(tc.body))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("status %d: %s", response.Code, response.Body.String())
			}
			for _, column := range []string{"avatar_url", "bio"} {
				expected := false
				for _, name := range tc.columns {
					expected = expected || name == column
				}
				if strings.Contains(sql, "`"+column+"`=?") != expected {
					t.Fatalf("unexpected columns in %q; expected %v", sql, tc.columns)
				}
			}
			if !strings.Contains(sql, "WHERE id=?") || !reflect.DeepEqual(values, tc.values) {
				t.Fatalf("SQL=%q values=%#v, expected %#v", sql, values, tc.values)
			}
		})
	}
}
