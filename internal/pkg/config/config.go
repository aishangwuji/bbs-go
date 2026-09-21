package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/mlogclub/simple/common/strs"
	"github.com/spf13/viper"
	"gopkg.in/yaml.v2"
)

const (
	BBSGO_ENV  = "BBSGO_ENV"
	ENV_PREFIX = "BBSGO"

	EnvDev  = "dev"
	EnvTest = "test"
	EnvProd = "prod"
)

type Language string

const (
	LanguageZhCN Language = "zh-CN"
	LanguageEnUS Language = "en-US"

	DefaultLanguage = LanguageEnUS
)

func (l Language) IsValid() bool {
	switch l {
	case LanguageZhCN, LanguageEnUS:
		return true
	}
	return false
}

var (
	Instance   *Config
	v          *viper.Viper
	configFile string
	writeMx    sync.Mutex
)

func init() {
	var (
		configFileName = "bbs-go.yaml"
	)
	v = viper.New()
	v.SetConfigFile(configFileName)
	v.AddConfigPath(".")
	if workDir, err := os.Executable(); err == nil {
		v.AddConfigPath(filepath.Dir(workDir))
	}
	v.AutomaticEnv()
	v.SetEnvPrefix(ENV_PREFIX)
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	configFile = getConfigFilePath(configFileName)
}

type Config struct {
	Language       Language      `yaml:"language"`       // 语言
	Port           int           `yaml:"port"`           // 端口
	IPLocator      IPLocator     `yaml:"ipLocator"`      // IP定位配置
	AllowedOrigins []string      `yaml:"allowedOrigins"` // 跨域白名单
	Installed      bool          `yaml:"installed"`      // 是否已安装
	IDCodec        IDCodecConfig `yaml:"idCodec"`        // ID 编解码配置
	Logger         LoggerConfig  `yaml:"logger"`         // 日志配置
	DB             DBConfig      `yaml:"db"`             // 数据库配置
	Smtp           SmtpConfig    `yaml:"smtp"`           // smtp
	Search         SearchConfig  `yaml:"search"`         // 搜索配置
	Jev            JevConfig     `yaml:"jev"`            // Jev 智能内容风控配置
}

type JevConfig struct {
	Enabled                  bool    `yaml:"enabled"`                  // 是否启用 Jev 智能风控
	ApiKey                   string  `yaml:"apiKey"`                   // TypeSafe API Key
	Endpoint                 string  `yaml:"endpoint"`                 // Jev API 接口地址
	Model                    string  `yaml:"model"`                    // 模型名称 (默认 jev-latest)
	TimeoutMs                int     `yaml:"timeoutMs"`                // 超时毫秒数 (默认 3000)
	AutoRejectScoreThreshold float64 `yaml:"autoRejectScoreThreshold"` // 自动驳回严重程度阈值 (Score 0~2)
	AutoRejectSpamThreshold  float64 `yaml:"autoRejectSpamThreshold"`  // 自动驳回垃圾概率阈值 (Noul 0~1)
	AutoReviewScoreThreshold float64 `yaml:"autoReviewScoreThreshold"` // 自动进入待审严重程度阈值 (Score 0~2)
	AutoReviewSpamThreshold  float64 `yaml:"autoReviewSpamThreshold"`  // 自动进入待审垃圾概率阈值 (Noul 0~1)
}

func SetJevDefaults(cfg *JevConfig) {
	if cfg == nil {
		return
	}
	if strs.IsBlank(cfg.Endpoint) {
		cfg.Endpoint = "https://api.typesafe.ai/v1/systemone"
	}
	if strs.IsBlank(cfg.Model) {
		cfg.Model = "jev-latest"
	}
	if cfg.TimeoutMs <= 0 {
		cfg.TimeoutMs = 3000
	}
	if cfg.AutoRejectScoreThreshold <= 0 {
		cfg.AutoRejectScoreThreshold = 1.5
	}
	if cfg.AutoRejectSpamThreshold <= 0 {
		cfg.AutoRejectSpamThreshold = 0.85
	}
	if cfg.AutoReviewScoreThreshold <= 0 {
		cfg.AutoReviewScoreThreshold = 0.8
	}
	if cfg.AutoReviewSpamThreshold <= 0 {
		cfg.AutoReviewSpamThreshold = 0.45
	}
}

type IPLocator struct {
	IPv4DataPath string `yaml:"ipv4DataPath"` // IPv4 数据文件路径
	IPv6DataPath string `yaml:"ipv6DataPath"` // IPv6 数据文件路径
}

type IDCodecConfig struct {
	Key uint64 `yaml:"key"` // ID 编解码秘钥
}

type LoggerConfig struct {
	Filename   string `yaml:"filename"`   // 日志文件的位置
	MaxSize    int    `yaml:"maxSize"`    // 文件最大尺寸（以MB为单位）
	MaxAge     int    `yaml:"maxAge"`     // 保留旧文件的最大天数
	MaxBackups int    `yaml:"maxBackups"` // 保留的最大旧文件数量
}

type DBConfig struct {
	Type                   string `yaml:"type"` // mysql, sqlite
	Url                    string `yaml:"url"`
	MaxIdleConns           int    `yaml:"maxIdleConns"`
	MaxOpenConns           int    `yaml:"maxOpenConns"`
	ConnMaxIdleTimeSeconds int    `yaml:"connMaxIdleTimeSeconds"`
	ConnMaxLifetimeSeconds int    `yaml:"connMaxLifetimeSeconds"`
	LogLevel               string `yaml:"logLevel"` // silent, error, warn, info
}

type SmtpConfig struct {
	Host     string `yaml:"host"`
	Port     string `yaml:"port"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	SSL      bool   `yaml:"ssl"`
}

type SearchConfig struct {
	IndexPath string `yaml:"indexPath"`
}

func ReadConfig() (cfg *Config, exists bool, err error) {
	exists = true
	if e := v.ReadInConfig(); e != nil {
		exists = false
		slog.Warn("Config file not found, use default", slog.Any("error", e))
	}

	if exists {
		if e := v.Unmarshal(&cfg); e != nil {
			err = fmt.Errorf("fatal error unmarshal config: %w", err)
			return
		}
		// 如果配置文件存在但没有语言设置，使用默认语言
		if strs.IsBlank(string(cfg.Language)) {
			cfg.Language = DefaultLanguage
		}
		SetDbDefaults(&cfg.DB)
		SetJevDefaults(&cfg.Jev)
	} else {
		// default config
		cfg = &Config{
			Language:  DefaultLanguage,
			Port:      8082,
			Installed: false,
			Logger: LoggerConfig{
				Filename:   getLogFilename(),
				MaxSize:    10,
				MaxAge:     10,
				MaxBackups: 10,
			},
			DB: defaultDbConfig(),
		}
	}

	return cfg, exists, nil
}

func WriteConfig(cfg *Config) error {
	if !writeMx.TryLock() {
		return errors.New("config is being written, please try again later")
	}
	defer writeMx.Unlock()

	yamlData, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}

	slog.Info("Write config", slog.String("configFile", configFile))

	err = os.WriteFile(configFile, yamlData, 0644)
	if err != nil {
		return err
	}
	return nil
}

func IsProd() bool {
	e := strings.ToLower(GetEnv())
	return e == "prod" || e == "production"
}

func GetEnv() string {
	env := os.Getenv("BBSGO_ENV")
	if strs.IsBlank(env) {
		env = EnvDev
	}
	return env
}

func getConfigFilePath(configName string) string {
	// Always prefer writing next to the working directory, even when the file does not yet exist.
	cwdPath := filepath.Join(".", configName)
	if _, err := os.Stat(cwdPath); err == nil {
		return cwdPath
	}
	// If CWD is accessible but file is missing, still choose CWD so installs do not drift to temp dirs.
	if _, err := os.Stat("."); err == nil {
		return cwdPath
	}

	// Fallbacks: first try beside the executable if reachable, otherwise return the bare name.
	if workDir, err := os.Executable(); err == nil {
		exePath := filepath.Join(filepath.Dir(workDir), configName)
		if _, err := os.Stat(exePath); err == nil {
			return exePath
		}
		return exePath
	}
	return configName
}

func GetConfigDir() string {
	return filepath.Dir(configFile)
}

func getLogFilename() string {
	// workDir, err := os.Getwd()
	// if err != nil {
	// 	slog.Error("Failed to get working directory", slog.Any("error", err))
	// 	return ""
	// }
	return filepath.Join("./", "logs", "bbs-go.log")
}

const (
	DbTypeMySQL       = "mysql"
	DbTypePostgreSQL  = "postgresql"
	DbTypeSQLite      = "sqlite"
	DefaultDBLogLevel = "warn"
)

func SetDbDefaults(c *DBConfig) {
	if c.Type == "" {
		c.Type = DbTypeMySQL
	}
	if c.MaxIdleConns == 0 {
		c.MaxIdleConns = 50
	}
	if c.MaxOpenConns == 0 {
		c.MaxOpenConns = 200
	}
	if c.ConnMaxIdleTimeSeconds == 0 {
		c.ConnMaxIdleTimeSeconds = 300
	}
	if c.ConnMaxLifetimeSeconds == 0 {
		c.ConnMaxLifetimeSeconds = 3600
	}
	if strs.IsBlank(c.LogLevel) {
		c.LogLevel = DefaultDBLogLevel
	}
}

func defaultDbConfig() DBConfig {
	return DBConfig{
		Type:                   DbTypeMySQL,
		MaxIdleConns:           50,
		MaxOpenConns:           200,
		ConnMaxIdleTimeSeconds: 300,
		ConnMaxLifetimeSeconds: 3600,
		LogLevel:               DefaultDBLogLevel,
	}
}
