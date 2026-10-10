package repositories

import (
	"bbs-go/internal/models"

	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var RewardTypeDefRepository = newRewardTypeDefRepository()

func newRewardTypeDefRepository() *rewardTypeDefRepository {
	return &rewardTypeDefRepository{}
}

type rewardTypeDefRepository struct {
}

func (r *rewardTypeDefRepository) Get(db *gorm.DB, id int64) *models.RewardTypeDef {
	ret := &models.RewardTypeDef{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *rewardTypeDefRepository) Take(db *gorm.DB, where ...interface{}) *models.RewardTypeDef {
	ret := &models.RewardTypeDef{}
	if err := db.Take(ret, where...).Error; err != nil {
		return nil
	}
	return ret
}

func (r *rewardTypeDefRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.RewardTypeDef) {
	cnd.Find(db, &list)
	return
}

func (r *rewardTypeDefRepository) FindOne(db *gorm.DB, cnd *sqls.Cnd) *models.RewardTypeDef {
	ret := &models.RewardTypeDef{}
	if err := cnd.FindOne(db, &ret); err != nil {
		return nil
	}
	return ret
}

func (r *rewardTypeDefRepository) FindPageByParams(db *gorm.DB, params *params.QueryParams) (list []models.RewardTypeDef, paging *sqls.Paging) {
	return r.FindPageByCnd(db, &params.Cnd)
}

func (r *rewardTypeDefRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.RewardTypeDef, paging *sqls.Paging) {
	cnd.Find(db, &list)
	count := cnd.Count(db, &models.RewardTypeDef{})

	paging = &sqls.Paging{
		Page:  cnd.Paging.Page,
		Limit: cnd.Paging.Limit,
		Total: count,
	}
	return
}

func (r *rewardTypeDefRepository) FindBySql(db *gorm.DB, sqlStr string, paramArr ...interface{}) (list []models.RewardTypeDef) {
	db.Raw(sqlStr, paramArr...).Scan(&list)
	return
}

func (r *rewardTypeDefRepository) CountBySql(db *gorm.DB, sqlStr string, paramArr ...interface{}) (count int64) {
	db.Raw(sqlStr, paramArr...).Count(&count)
	return
}

func (r *rewardTypeDefRepository) Count(db *gorm.DB, cnd *sqls.Cnd) int64 {
	return cnd.Count(db, &models.RewardTypeDef{})
}

func (r *rewardTypeDefRepository) Create(db *gorm.DB, t *models.RewardTypeDef) (err error) {
	err = db.Create(t).Error
	return
}

func (r *rewardTypeDefRepository) Update(db *gorm.DB, t *models.RewardTypeDef) (err error) {
	err = db.Save(t).Error
	return
}

func (r *rewardTypeDefRepository) Updates(db *gorm.DB, id int64, columns map[string]interface{}) (err error) {
	err = db.Model(&models.RewardTypeDef{}).Where("id = ?", id).Updates(columns).Error
	return
}

func (r *rewardTypeDefRepository) UpdateColumn(db *gorm.DB, id int64, name string, value interface{}) (err error) {
	err = db.Model(&models.RewardTypeDef{}).Where("id = ?", id).UpdateColumn(name, value).Error
	return
}

func (r *rewardTypeDefRepository) Delete(db *gorm.DB, id int64) {
	db.Delete(&models.RewardTypeDef{}, "id = ?", id)
}
