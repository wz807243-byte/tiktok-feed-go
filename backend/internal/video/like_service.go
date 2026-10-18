package video

import (
	"context"
	"errors"
	"feedsystem_video_go/internal/middleware/rabbitmq"
	rediscache "feedsystem_video_go/internal/middleware/redis"
	"time"

	"github.com/go-sql-driver/mysql"
	"gorm.io/gorm"
)

func isDupKey(err error) bool {
	var me *mysql.MySQLError
	return errors.As(err, &me) && me.Number == 1062
}

type LikeService struct {
	repo         *LikeRepository
	VideoRepo    *VideoRepository
	cache        *rediscache.Client
	likeMQ       *rabbitmq.LikeMQ
	popularityMQ *rabbitmq.PopularityMQ
}

func NewLikeService(repo *LikeRepository, VideoRepo *VideoRepository, cache *rediscache.Client,
	likeMQ *rabbitmq.LikeMQ, popularityMQ *rabbitmq.PopularityMQ) *LikeService {
	return &LikeService{
		repo:         repo,
		VideoRepo:    VideoRepo,
		cache:        cache,
		likeMQ:       likeMQ,
		popularityMQ: popularityMQ,
	}
}

func (ls *LikeService) Like(ctx context.Context, like *Like, cache *rediscache.Client) error {
	if like == nil {
		return errors.New("like=nil ")
	}
	if like.AccountID == 0 || like.VideoID == 0 {
		return errors.New("video_id and account_id are required")

	}
	if ls.VideoRepo != nil {
		ok, err := ls.VideoRepo.IsExist(ctx, like.VideoID)
		if err != nil {
			return err
		}
		if !ok {
			return err
		}
	}
	liked, err := ls.repo.isLike(ctx, like.VideoID, like.AccountID)
	if err != nil {
		return err
	}
	if liked {
		return nil
	}

	like.CreatedAt = time.Now()
	mysqlEnqueued := false
	redisEnqueued := false

	if err := ls.likeMQ.Like(ctx, like.AccountID, like.VideoID); err == nil {
		mysqlEnqueued = true
	}

	if ls.popularityMQ != nil {
		if err := ls.popularityMQ.Update(ctx, like.VideoID, 1); err == nil {
			redisEnqueued = true
		}
	}
	if mysqlEnqueued && redisEnqueued {
		return nil
	}

	if !mysqlEnqueued {
		err := ls.repo.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := tx.Select("id").First(&Video{}, like.VideoID).Error; err != nil {
				return err
			}
			if err := tx.Create(like).Error; err != nil {
				if isDupKey(err) {
					return err
				}
				return err
			}
			if err := tx.Model(&Video{}).Where("id=?", like.VideoID).
				UpdateColumn("likes_count", gorm.Expr("likes_count + 1")).Error; err != nil {
				return err

			}
			return tx.Model(&Video{}).Where("id=?", like.VideoID).
				UpdateColumn("popularity", gorm.Expr("popularity + 1")).
				Error

		})
		if err != nil {
			return err
		}
	}
	if !redisEnqueued {
		UpdatePopularityCache(ctx, ls.cache, like.VideoID, 1)
	}

	return nil
}

func (ls *LikeService) ULike(ctx context.Context, like *Like) error {
	if like == nil {
		return errors.New("like is nil")
	}
	if like.AccountID == 0 || like.VideoID == 0 {
		return errors.New("like.AccountID == 0 or like.VideoID == 0")

	}
	ok, err := ls.VideoRepo.IsExist(ctx, like.VideoID)
	if err != nil {
		return err

	}
	if !ok {
		return err
	}
	islike, err := ls.repo.isLike(ctx, like.VideoID, like.AccountID)
	if err != nil {
		return err

	}
	if !islike {
		return nil
	}

	mysqlEnqueued := false
	redisEnqueued := false
	if ls.likeMQ.Unlike(ctx, like.AccountID, like.VideoID); err == nil {
		mysqlEnqueued = true
	}
	if ls.popularityMQ != nil {
		if err := ls.popularityMQ.Update(ctx, like.VideoID, -1); err == nil {
			redisEnqueued = true
		}
	}
	if mysqlEnqueued && redisEnqueued {
		return nil
	}

	if !mysqlEnqueued {
		err := ls.repo.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			dele := tx.Where("video_id=? AND account_id = ?", like.VideoID, like.AccountID).Delete(&Like{})
			if dele.Error != nil {
				return dele.Error
			}
			if dele.RowsAffected == 0 {
				return err
			}
			if err := tx.Model(&Video{}).Where("id=?", like.VideoID).UpdateColumn("likes_count", gorm.Expr("GREATEST(likes_count - 1, 0)")).Error; err != nil {
				return err
			}
			return tx.Model(&Video{}).Where("id=?", like.VideoID).UpdateColumn("popularity", gorm.Expr("GREATEST(popularity - 1, 0)")).Error

		})
		if err != nil {
			return err
		}
	}
	if !redisEnqueued {
		UpdatePopularityCache(ctx, ls.cache, like.VideoID, -1)

	}
	return nil
}

func (ls *LikeService) ListLikedVideos(ctx context.Context, accountID uint) ([]Video, error) {
	return ls.repo.ListLikedVideos(ctx, accountID)
}
func (ls *LikeService) IsLiked(ctx context.Context, videoID uint, accountID uint) (bool, error) {
	return ls.repo.isLike(ctx, videoID, accountID)
}
