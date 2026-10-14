package repositories

import (
	"bbs-go/internal/models"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var OAuthTokenRepository = newOAuthTokenRepository()

func newOAuthTokenRepository() *oauthTokenRepository {
	return &oauthTokenRepository{}
}

type oauthTokenRepository struct {
}

func (r *oauthTokenRepository) Get(db *gorm.DB, id int64) *models.OAuthToken {
	ret := &models.OAuthToken{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *oauthTokenRepository) GetByToken(db *gorm.DB, token string) *models.OAuthToken {
	ret := &models.OAuthToken{}
	if err := db.Where("token = ?", token).Take(ret).Error; err != nil {
		return nil
	}
	return ret
}

func (r *oauthTokenRepository) Take(db *gorm.DB, where ...interface{}) *models.OAuthToken {
	ret := &models.OAuthToken{}
	if err := db.Take(ret, where...).Error; err != nil {
		return nil
	}
	return ret
}

func (r *oauthTokenRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.OAuthToken) {
	cnd.Find(db, &list)
	return
}

func (r *oauthTokenRepository) FindOne(db *gorm.DB, cnd *sqls.Cnd) *models.OAuthToken {
	ret := &models.OAuthToken{}
	if err := cnd.FindOne(db, &ret); err != nil {
		return nil
	}
	return ret
}

func (r *oauthTokenRepository) FindPageByParams(db *gorm.DB, params *params.QueryParams) (list []models.OAuthToken, paging *sqls.Paging) {
	return r.FindPageByCnd(db, &params.Cnd)
}

func (r *oauthTokenRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.OAuthToken, paging *sqls.Paging) {
	cnd.Find(db, &list)
	count := cnd.Count(db, &models.OAuthToken{})

	paging = &sqls.Paging{
		Page:  cnd.Paging.Page,
		Limit: cnd.Paging.Limit,
		Total: count,
	}
	return
}

func (r *oauthTokenRepository) Create(db *gorm.DB, t *models.OAuthToken) (err error) {
	err = db.Create(t).Error
	return
}

func (r *oauthTokenRepository) Update(db *gorm.DB, t *models.OAuthToken) (err error) {
	err = db.Save(t).Error
	return
}

func (r *oauthTokenRepository) Updates(db *gorm.DB, id int64, columns map[string]interface{}) (err error) {
	err = db.Model(&models.OAuthToken{}).Where("id = ?", id).Updates(columns).Error
	return
}

func (r *oauthTokenRepository) UpdateColumn(db *gorm.DB, id int64, name string, value interface{}) (err error) {
	err = db.Model(&models.OAuthToken{}).Where("id = ?", id).Update(name, value).Error
	return
}

func (r *oauthTokenRepository) Delete(db *gorm.DB, id int64) (err error) {
	err = db.Delete(&models.OAuthToken{}, "id = ?", id).Error
	return
}
