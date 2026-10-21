package account

import (
	"context"
	"errors"
	"feedsystem_video_go/internal/auth"
	rediscache "feedsystem_video_go/internal/middleware/redis"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrUsernameTaken       = errors.New("username already exists")
	ErrNewUsernameRequired = errors.New("new_username is required")
)

type AccountService struct {
	accountRepository *AccountRepository
	cache             *rediscache.Client
}

func NewAccountService(accountRepository *AccountRepository, cache *rediscache.Client) *AccountService {
	return &AccountService{accountRepository: accountRepository, cache: cache}

}
func (as *AccountService) CreateAccount(ctx context.Context, account *Account) error {
	passwordHars, err := bcrypt.GenerateFromPassword([]byte(account.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	account.Password = string(passwordHars)
	if err := as.accountRepository.CreateAccount(ctx, account); err != nil {
		return err
	}
	return nil
}
func (as *AccountService) FindByUsername(ctx context.Context, username string) (*Account, error) {
	account, err := as.accountRepository.FindByUsername(ctx, username)
	if err != nil {
		return nil, err
	}
	return account, nil
}
func (as *AccountService) FindByID(ctx context.Context, id uint) (*Account, error) {
	account, err := as.accountRepository.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return account, nil
}
func (as *AccountService) Login(ctx context.Context, username string, password string) (string, string, error) {
	account, err := as.FindByUsername(ctx, username)
	if err != nil {
		return "", "", err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(account.Password), []byte(password)); err != nil {
		return "", "", err
	}
	accessToken, err := auth.GenerateToken(account.ID, account.Username)
	if err != nil {
		return "", "", err
	}
	refreshToken, err := auth.GenerateRefreshToken(account.ID)
	if err != nil {
		return "", "", err
	}
	if err := as.accountRepository.Login(ctx, account.ID, accessToken, refreshToken); err != nil {
		return "", "", err
	}
	if as.cache != nil {
		cacheCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
		defer cancel()
		if err := as.cache.SetBytes(cacheCtx, as.cache.Key("account:%d", account.ID), []byte(accessToken), 24*time.Hour); err != nil {
			return "", "", err
		}
		if err := as.cache.SetBytes(cacheCtx, as.cache.Key("account:%d:refresh", account.ID), []byte(refreshToken), 24*time.Hour); err != nil {
			return "", "", err
		}
		if err := as.cache.SetBytes(cacheCtx, as.cache.Key("refresh:%s", refreshToken), []byte(strconv.FormatUint(uint64(account.ID), 10)), 24*time.Hour); err != nil {
			return "", "", err
		}
	}
	return accessToken, refreshToken, nil
}
func (as *AccountService) Logout(ctx context.Context, accountID uint) error {
	account, err := as.FindByID(ctx, accountID)
	if err != nil {
		return err
	}
	if account.Token == "" {
		return nil
	}
	if as.cache != nil {
		cacheCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
		defer cancel()
		if err := as.cache.Del(cacheCtx, as.cache.Key("account:%d", account.ID)); err != nil {
			return err
		}
		if err := as.cache.Del(cacheCtx, as.cache.Key("account:%d:refresh", account.ID)); err != nil {
			return err
		}
		if account.RefreshToken != "" {
			_ = as.cache.Del(cacheCtx, as.cache.Key("refresh:%s", account.RefreshToken))
		}
	}
	return as.accountRepository.Logout(ctx, account.ID)
}
func (as *AccountService) UpdateProfile(ctx context.Context, accountID uint, req *UpdateProfileRequest) error {
	updates := map[string]interface{}{}
	if req.Bio != nil {
		updates["bio"] = strings.TrimSpace(*req.Bio)
	}
	if req.AvatarURL != nil {
		updates["avatar_url"] = strings.TrimSpace(*req.AvatarURL)
	}
	if len(updates) == 0 {
		return errors.New("nothing to update")

	}
	return as.accountRepository.UpdateFields(ctx, accountID, updates)
}
func (as *AccountService) UpdateAvatar(ctx context.Context, id uint, avatarURL string) error {
	return as.accountRepository.UpdateAvatar(ctx, id, avatarURL)
}
func (as *AccountService) Rename(ctx context.Context, accountID uint, NewUsername string) (string, error) {
	if NewUsername == "" {
		return "", ErrNewUsernameRequired
	}
	token, err := auth.GenerateToken(accountID, NewUsername)
	if err != nil {
		return "", err
	}
	if err := as.accountRepository.RenameWithToken(ctx, accountID, NewUsername, token); err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			return "", ErrUsernameTaken
		} //检查错误是否是“记录未找到
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", err
		}
		return "", err
	}
	if as.cache != nil {
		cacheCtx, cancel := context.WithTimeout(ctx, 50*time.Microsecond)
		defer cancel()
		if err := as.cache.SetBytes(cacheCtx, as.cache.Key("account:%d", accountID), []byte(token), 24*time.Hour); err != nil {
			return "", err
		}
	}
	return token, nil
}

func (as *AccountService) ChangePassword(ctx context.Context, userName string, olPassword string, newPassword string) error {
	account, err := as.FindByUsername(ctx, userName)
	if err != nil {
		fmt.Print("1")
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(account.Password), []byte(olPassword)); err != nil {
		fmt.Print("2")
		return err
	}
	newpasswordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		fmt.Print("3")
		return err
	}
	if err := as.accountRepository.ChangePassword(ctx, account.ID, string(newpasswordHash)); err != nil {
		fmt.Print("4")
		return err
	}
	if err := as.Logout(ctx, account.ID); err != nil {
		fmt.Print("5")
		return err
	}
	return nil
}

func (as *AccountService) RefreshAccessToken(ctx context.Context, newToken string) (uint, string, string, error) {
	if newToken == "" {
		return 0, "", "", errors.New("refresh token is empty")
	}
	var account *Account
	if as.cache != nil {
		cacheCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
		accountIDBytes, cacheErr := as.cache.GetBytes(cacheCtx, as.cache.Key("refresh:%s", newToken))
		cancel()
		if cacheErr == nil {
			if accountID, err := strconv.ParseUint(string(accountIDBytes), 10, 64); err == nil {
				candidate, err := as.FindByID(ctx, uint(accountID))
				if err == nil && candidate != nil && candidate.RefreshToken == newToken {
					account = candidate
				}
			}
		}
	}
	if account == nil {
		var err error
		account, err = as.accountRepository.FindByRefreshToken(ctx, newToken)
		if err != nil {
			return 0, "", "", err
		}
	}
	accessToken, err := auth.GenerateToken(account.ID, account.Username)
	if err != nil {
		return 0, "", "", err
	}
	if err := as.accountRepository.UpdateToken(ctx, account.ID, accessToken); err != nil {
		return 0, "", "", err
	}
	if as.cache != nil {
		// Start the write deadline after SQL work; cached lookup and DB fallback
		// must both replace the access token that JWT middleware reads.
		cacheCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
		defer cancel()
		if err := as.cache.SetBytes(cacheCtx, as.cache.Key("account:%d", account.ID), []byte(accessToken), 24*time.Hour); err != nil {
			// A stale value must not indefinitely hide the newly committed token.
			deleteCtx, deleteCancel := context.WithTimeout(ctx, 50*time.Millisecond)
			_ = as.cache.Del(deleteCtx, as.cache.Key("account:%d", account.ID))
			deleteCancel()
		}
		_ = as.cache.SetBytes(cacheCtx, as.cache.Key("account:%d:refresh", account.ID), []byte(newToken), 24*time.Hour)
		_ = as.cache.SetBytes(cacheCtx, as.cache.Key("refresh:%s", newToken), []byte(strconv.FormatUint(uint64(account.ID), 10)), 24*time.Hour)
	}
	return account.ID, account.Username, accessToken, nil
}
