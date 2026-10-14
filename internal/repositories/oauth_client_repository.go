package repositories

import (
	"bbs-go/internal/models"
	"bbs-go/internal/pkg/params"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var OAuthClientRepository = newOAuthClientRepository()

func newOAuthClientRepository() *oauthClientRepository {
	return &oauthClientRepository{}
}

type oauthClientRepository struct {
}

func (r *oauthClientRepository) Get(db *gorm.DB, id int64) *models.OAuthClient {
	ret := &models.OAuthClient{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *oauthClientRepository) GetByClientId(db *gorm.DB, clientId string) *models.OAuthClient {
	ret := &models.OAuthClient{}
	if err := db.Where("client_id = ?", clientId).Take(ret).Error; err != nil {
		return nil
	}
	return ret
}

func (r *oauthClientRepository) Take(db *gorm.DB, where ...interface{}) *models.OAuthClient {
	ret := &models.OAuthClient{}
	if err := db.Take(ret, where...).Error; err != nil {
		return nil
	}
	return ret
}

func (r *oauthClientRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.OAuthClient) {
	cnd.Find(db, &list)
	return
}

func (r *oauthClientRepository) FindOne(db *gorm.DB, cnd *sqls.Cnd) *models.OAuthClient {
	ret := &models.OAuthClient{}
	if err := cnd.FindOne(db, &ret); err != nil {
		return nil
	}
	return ret
}

func (r *oauthClientRepository) FindPageByParams(db *gorm.DB, params *params.QueryParams) (list []models.OAuthClient, paging *sqls.Paging) {
	return r.FindPageByCnd(db, &params.Cnd)
}

func (r *oauthClientRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.OAuthClient, paging *sqls.Paging) {
	cnd.Find(db, &list)
	count := cnd.Count(db, &models.OAuthClient{})

	paging = &sqls.Paging{
		Page:  cnd.Paging.Page,
		Limit: cnd.Paging.Limit,
		Total: count,
	}
	return
}

func (r *oauthClientRepository) Create(db *gorm.DB, t *models.OAuthClient) (err error) {
	err = db.Create(t).Error
	return
}

func (r *oauthClientRepository) Update(db *gorm.DB, t *models.OAuthClient) (err error) {
	err = db.Save(t).Error
	return
}

func (r *oauthClientRepository) Updates(db *gorm.DB, id int64, columns map[string]interface{}) (err error) {
	err = db.Model(&models.OAuthClient{}).Where("id = ?", id).Updates(columns).Error
	return
}

func (r *oauthClientRepository) UpdateColumn(db *gorm.DB, id int64, name string, value interface{}) (err error) {
	err = db.Model(&models.OAuthClient{}).Where("id = ?", id).Update(name, value).Error
	return
}

func (r *oauthClientRepository) Delete(db *gorm.DB, id int64) (err error) {
	err = db.Delete(&models.OAuthClient{}, "id = ?", id).Error
	return
}
