package jev

import "encoding/json"

// QuestionType 问题类型定义
type QuestionType string

const (
	TypeChoice QuestionType = "choice" // 选择题：从固定选项中选择，附带概率分布和置信度
	TypeScore  QuestionType = "score"  // 谱系打分题：在有序谱系中打分，返回连续值、离散概率分布和置信度
	TypeNoul   QuestionType = "noul"   // 布尔概率题：判断陈述是否属实，返回 0~1 的确定概率
)

// Question 单个评测问题定义
// 根据 Jev 规范：instructions 与 criteria 可以是纯 string，也可以是结构化 JSON 对象或数组
type Question struct {
	Type         QuestionType `json:"type"`                   // 问题类型："choice" | "score" | "noul"
	Instructions any          `json:"instructions"`           // 评测指令或结构化对象 (string | map | slice)
	Criteria     any          `json:"criteria,omitempty"`     // 判定准则：Choice 对应选项字典；Score 对应分级数组；Noul 对应 true/false 映射
}

// SystemOneRequest 提交给 Jev 模型的评测请求体
type SystemOneRequest struct {
	Model     string              `json:"model"`     // 模型标识，例如 "jev-latest" 或固定版本 "jev-1.13.0"
	State     any                 `json:"state"`     // 被评估的主体数据（可以是纯文本 string，也可以是带上下文的 JSON 对象）
	Questions map[string]Question `json:"questions"` // 并行评测的问题映射表（QuestionID -> Question）
}

// ChoiceAnswer Choice 问题类型的返回值
type ChoiceAnswer struct {
	Type          string             `json:"type"`          // 固定为 "choice"
	Choice        string             `json:"choice"`        // 概率最高的优胜选项标识
	Confidence    float64            `json:"confidence"`    // 判定置信度 (0.0~1.0，反映概率分布的陡峭程度)
	Probabilities map[string]float64 `json:"probabilities"` // 所有选项的归一化概率分布（和为 1.0）
}

// ScoreAnswer Score 问题类型的返回值
type ScoreAnswer struct {
	Type          string             `json:"type"`          // 固定为 "score"
	Score         float64            `json:"score"`         // 连续谱系位置加权得分（各级序号乘以其概率的期望值）
	Confidence    float64            `json:"confidence"`    // 判定置信度 (0.0~1.0)
	Legend        map[string]any     `json:"legend"`        // 各分级与其描述的回显对照表
	Probabilities map[string]float64 `json:"probabilities"` // 每个离散级别的概率分布 (键为级别索引 "0", "1", ...)
}

// NoulAnswer Noul 问题类型的返回值
// 注意：Noul 仅评估二元命题的真实性，noul 字段本身即为概率与确定性，没有独立的 confidence 字段
type NoulAnswer struct {
	Type string  `json:"type"` // 固定为 "noul"
	Noul float64 `json:"noul"` // 该陈述为 True 的校准概率 (0.0 表示绝对否定，1.0 表示绝对肯定)
}

// SystemOneResponse Jev API 的统一响应结构
type SystemOneResponse struct {
	Model   string                     `json:"model"`   // 实际响应的模型版本
	Answers map[string]json.RawMessage `json:"answers"` // 问题 ID -> 原始 JSON 块 (按需二次反序列化)
	Usage   Usage                      `json:"usage"`   // Token 消耗统计
}

// Usage Token 计量信息
type Usage struct {
	InputTokens  int `json:"input_tokens"`  // 提示输入消耗的 Token 数
	OutputTokens int `json:"output_tokens"` // 结构化决策输出消耗的 Token 数
}
