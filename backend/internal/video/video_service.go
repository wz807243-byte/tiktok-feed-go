package video

import (
	"context"
	"errors"
	"feedsystem_video_go/internal/middleware/rabbitmq"
	rediscache "feedsystem_video_go/internal/middleware/redis"
	"strings"
	"time"

	"gorm.io/gorm"
)

type VideoService struct {
	videorepo    *VideoRepository
	cache        *rediscache.Client
	cacheTTL     time.Duration
	popularityMQ *rabbitmq.PopularityMQ
}

func NewVideoService(repo *VideoRepository, cache *rediscache.Client, popularityMQ *rabbitmq.PopularityMQ) *VideoService {
	return &VideoService{videorepo: repo, cache: cache, cacheTTL: 5 * time.Minute, popularityMQ: popularityMQ}
}
func (vs *VideoService) Publish(ctx context.Context, video *Video) error {
	if video == nil {
		return errors.New("video is nil	")
	}
	// 去除空格
	video.Title = strings.TrimSpace(video.Title)
	video.PlayURL = strings.TrimSpace(video.PlayURL)
	video.CoverURL = strings.TrimSpace(video.CoverURL)
	if video.Title == "" {
		return errors.New("Title is nil	")
	}
	if video.PlayURL == "" {
		return errors.New("PlayURL is nil	")
	}
	if video.CoverURL == "" {
		return errors.New("CoverURL is nil	")
	}

	err := vs.videorepo.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(video).Error; err != nil {
			return err
		}
		msg := OutboxMsg{
			VideoID:    video.ID,
			EventType:  "video_published",
			Status:     "pending",
			CreateTime: video.CreateTime,
		}
		if err := tx.Create(&msg).Error; err != nil {
			return err
		}
		tags := ExtractTags(video.Title + " " + video.Description)
		for _, tagName := range tags {
			var tag Tag
			if err := tx.Where("name = ?", tagName).FirstOrCreate(&tag, Tag{Name: tagName}).Error; err != nil {
				return err
			}
			if err := tx.Create(&VideoTag{VideoID: video.ID, TagID: tag.ID}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return err

}

func (vs *VideoService) ListByAuthorID(ctx context.Context, id uint) ([]Video, error) {
	if id == 0 {
		return nil, errors.New("id is nil")
	}
	video, err := vs.videorepo.ListByAuthorID(ctx, int64(id))
	if err != nil {
		return nil, err
	}
	return video, err
}

// func (vs *VideoService) GetDetail(ctx context.Context, id uint) (*Video, error) {
// 	if id == 0 {
// 		return nil, errors.New("id is nil")
// 	}
// 	cacheKey := vs.cache.Key("video:detail:id=%d", id)
// 	getCached := func() (*Video, bool) {
// 		opctx, cancel := context.WithTimeout(ctx, 50*time.Microsecond)
// 		defer cancel()
// 		b, err := vs.cache.GetBytes(opctx, cacheKey)
// 		if err != nil {
// 			return nil, false
// 		}
// 		var cached Video
// 		if err := json.Unmarshal(b, &cached); err != nil {
// 			return nil, false
// 		}
// 		return &cached, true
// 	}
// 	setCached := func(video *Video) {
// 		b, err := json.Marshal(video)
// 		if err != nil {
// 			return
// 		}
// 		opCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
// 		defer cancel()
// 		_ = vs.cache.SetBytes(opCtx, cacheKey, b, vs.cacheTTL)
// 	}
// 	if vs.cache != nil {
// 		if v, ok := getCached(); ok {
// 			return v, nil

// 		}
// 		opCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
// 		defer cancel()
// 		b, err := vs.cache.GetBytes(opCtx, cacheKey)
// 		if err == nil {
// 			var cached Video
// 			if err := json.Unmarshal(b, &cached); err == nil {
// 				return &cached, nil
// 			}

// 		} else if rediscache.IsMiss(err) {
// 			lockkey := "lock:" + cacheKey
// 			lockCtx, lockCancel := context.WithTimeout(ctx, 50*time.Millisecond)
// 			token, locked, lockErr := vs.cache.Lock(lockCtx, lockkey, 2*time.Second)
// 			lockCancel

// 		}
// 	}
// }
