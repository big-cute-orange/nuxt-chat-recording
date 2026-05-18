import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

export const useMarkdown = () => {
  const md = new MarkdownIt({
    html: false, // 不允许原生 HTML（安全）
    xhtmlOut: false,
    breaks: true, // 关键：换行自动转 <br>
    linkify: true, // 自动识别链接
    typographer: true,
    highlight: (code, lang) => {
      // 代码高亮逻辑
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      try {
        return hljs.highlight(code, { language }).value
      } catch {
        return code
      }
    },
  })

  // 渲染函数
  const render = (content: string) => {
    if (!content) return ''
    return md.render(content)
  }

  return { render }
}
