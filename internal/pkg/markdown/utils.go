package markdown

import (
	"bbs-go/internal/pkg/html"
	"sync"

	"github.com/88250/lute"
	"github.com/microcosm-cc/bluemonday"
	"github.com/mlogclub/simple/common/strs"
)

var (
	engine          *lute.Lute
	once            sync.Once
	signaturePolicy *bluemonday.Policy
	signatureOnce   sync.Once
)

func getEngine() *lute.Lute {
	once.Do(func() {
		engine = lute.New(func(lute *lute.Lute) {
			// lute.SetToC(true)
			lute.SetSanitize(true)
			lute.SetGFMTaskListItem(true)
		})
	})
	return engine
}

func ToHTML(markdownStr string) string {
	if strs.IsBlank(markdownStr) {
		return ""
	}
	return getEngine().MarkdownStr("", markdownStr)
}

func GetSummary(markdownStr string, summaryLen int) string {
	htmlStr := ToHTML(markdownStr)
	return html.GetSummary(htmlStr, summaryLen)
}

func getSignaturePolicy() *bluemonday.Policy {
	signatureOnce.Do(func() {
		p := bluemonday.NewPolicy()
		// 严格白名单：仅保留签名所需的轻量排版，避免喧宾夺主与 XSS
		// 允许的块级/行内标签（刻意剔除 h1-h6、table、iframe、script 等）
		p.AllowElements("p", "span", "strong", "em", "code", "pre", "blockquote", "del", "ul", "ol", "li", "br")
		// 链接：仅 http/https，自动补 nofollow/noreferrer + target_blank
		p.AllowAttrs("href", "title").OnElements("a")
		p.RequireParseableURLs(true)
		p.AllowURLSchemes("http", "https")
		p.RequireNoReferrerOnLinks(true)
		p.AddTargetBlankToFullyQualifiedLinks(true)
		// 图片：仅 http/https，受控于外链 favicon 思路，不本地存储签名图片
		p.AllowAttrs("src", "alt", "title", "class").OnElements("img")
		p.AllowURLSchemes("http", "https")
		signaturePolicy = p
	})
	return signaturePolicy
}

// ToSignatureHTML 将签名 Markdown 转为严格消毒后的安全 HTML（用于楼层展示）
// 流程：lute MarkdownStr -> bluemonday 白名单过滤 -> 返回可直接 template.HTML 渲染的片段
// 设计要点：
// - 为何存 Markdown 原文而非 HTML：编辑回显友好、后续可换解析器或收紧策略而无需刷库
// - 为何 lute+bluemonday 双层：lute 已做基础 Sanitize，bluemonday 再做签名级“最小权限”裁剪（禁大标题、防 js 伪协议）
// - 性能：签名变更低频，渲染结果可被上层缓存（如 Redis user:signature:html:{userId}），此处仅做单次转换
func ToSignatureHTML(markdownStr string) string {
	if strs.IsBlank(markdownStr) {
		return ""
	}
	// 先走与正文一致的 Markdown 引擎，保持 GFM 一致性
	rawHTML := getEngine().MarkdownStr("", markdownStr)
	// 再走签名级严格白名单
	safeHTML := getSignaturePolicy().Sanitize(rawHTML)
	return safeHTML
}
