package video

import (
	"context"

	"gorm.io/gorm"
)

type VideoRepository struct {
	db *gorm.DB
}

func NewVideoRepositor(db *gorm.DB) *VideoRepository {
	return &VideoRepository{
		db: db,
	}
}
func (vr *VideoRepository) CreateVideo(ctx context.Context, video *Video) error {
	return vr.db.WithContext(ctx).Create(&video).Error
}
func (vr *VideoRepository) ListByAuthorID(ctx context.Context, id int64) ([]Video, error) {
	var videos []Video
	if err := vr.db.WithContext(ctx).
		Where("author_id", id).
		Order("create_time desc").
		Limit(200).
		Find(&videos).Error; err != nil {
		return nil, err
	}
	return videos, nil
}
func (vr *VideoRepository) IsExist(ctx context.Context, id uint) (bool, error) {
	var videoid Video
	if err := vr.db.WithContext(ctx).First(&videoid, id).Error; err != nil {
		return false, err
	}
	return true, nil
}

func (vr *VideoRepository) ChangeLikesCount(ctx context.Context, id uint, change int64) error {
	if err := vr.db.WithContext(ctx).Model(&Video{}).
		Where("id = ?", id).
		UpdateColumn("likes_count", gorm.Expr("GREATEST(likes_count + ?, 0)", change)).Error; err != nil {
		return err
	}
	return nil
}
func (vr *VideoRepository) ChangePopularity(ctx context.Context, id uint, change int64) error {
	if err := vr.db.WithContext(ctx).Model(&Video{}).
		Where("id = ?", id).
		UpdateColumn("popularity", gorm.Expr("GREATEST(popularity + ?, 0)", change)).Error; err != nil {
		return err
	}
	return nil
}
