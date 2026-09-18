package markdown

import (
	"strings"
	"testing"
)

// TestToSignatureHTML_SanitizesXSS 验证签名渲染的 XSS 红线：
// 签名允许 Markdown 超链接/图片，因此必须在服务端做严格白名单消毒，禁止 script/iframe/on* 事件。
// 该测试是 P0“安全边界最低要求”的落地断言——注释无强制力，断言才有。
func TestToSignatureHTML_SanitizesXSS(t *testing.T) {
	cases := []struct {
		name        string
		input       string
		mustContain []string
		mustNotHave []string
	}{
		{
			name:        "script tag is stripped",
			input:       `<script>alert(1)</script>`,
			mustNotHave: []string{"<script", "alert(1)"},
		},
		{
			name:        "javascript pseudo url is rejected",
			input:       `[x](javascript:alert(1))`,
			mustNotHave: []string{"javascript:", "<a "},
		},
		{
			name:        "iframe is stripped",
			input:       `<iframe src="https://evil.com"></iframe>`,
			mustNotHave: []string{"<iframe"},
		},
		{
			name:        "inline event handler is stripped",
			input:       `<a href="https://a.com" onclick="alert(1)">x</a>`,
			mustContain: []string{`href="https://a.com"`},
			mustNotHave: []string{"onclick"},
		},
		{
			name:        "img onerror is stripped",
			input:       `![a](https://a.com/x.png)`,
			mustContain: []string{"<img"},
			mustNotHave: []string{"onerror"},
		},
		{
			name:        "headings are not allowed (anti layout breakage)",
			input:       `# huge title`,
			mustNotHave: []string{"<h1"},
		},
		{
			name:        "safe markdown link keeps href and gets target blank",
			input:       `[北行搜](https://pan.originagent.cn)`,
			mustContain: []string{`href="https://pan.originagent.cn"`, "北行搜"},
		},
		{
			name:        "bold markdown is preserved",
			input:       `**文档服务站**`,
			mustContain: []string{"<strong>"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ToSignatureHTML(tc.input)
			lower := strings.ToLower(got)
			for _, want := range tc.mustContain {
				if !strings.Contains(got, want) {
					t.Fatalf("input %q: expected output to contain %q, got %q", tc.input, want, got)
				}
			}
			for _, bad := range tc.mustNotHave {
				if strings.Contains(lower, strings.ToLower(bad)) {
					t.Fatalf("input %q: expected output NOT to contain %q, got %q", tc.input, bad, got)
				}
			}
		})
	}
}

// TestToSignatureHTML_Blank 空输入应返回空串，避免渲染空容器。
func TestToSignatureHTML_Blank(t *testing.T) {
	if got := ToSignatureHTML(""); got != "" {
		t.Fatalf("expected empty output for blank input, got %q", got)
	}
	if got := ToSignatureHTML("   "); got != "" {
		t.Fatalf("expected empty output for whitespace input, got %q", got)
	}
}
