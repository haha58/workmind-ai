// server/src/index.js
// 服务端入口：注册中间件、路由、启动服务
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import cors from 'cors'
import { validateConfig, config } from './config/index.js'
import { requestLogger } from './middleware/index.js'
import { errorMiddleware } from './utils/errors.js'
import { logger } from './utils/logger.js'
import { chatRouter } from './routes/chat.js'
import { knowledgeRouter } from './routes/knowledge.js'
import { agentRouter } from './routes/agent.js'
import { workflowRouter } from './routes/workflow.js'
import { erpRouter } from './routes/erp.js'
import { promptRouter } from './routes/prompt.js'
import { monitorRouter } from './routes/monitor.js'
import { healthRouter } from './routes/health.js'

// 启动前校验配置
validateConfig()

const app = express()

// ── 基础中间件 ─────────────────────────────────────────────────
//Helmet 是一个 Express.js 的安全中间件,通过设置各种 HTTP 响应头来保护应用免受常见攻击。
//contentSecurityPolicy: false 禁用了 Content-Security-Policy (CSP) 头
app.use(helmet({ contentSecurityPolicy: false }))
//compression 压缩 HTTP 响应,减少传输数据量,提升页面加载速度。
app.use(compression())
app.use(cors({
  origin: config.app.allowedOrigins,  // 指定允许访问 API 的前端域名列表
  credentials: true, // 允许跨域请求携带 cookie
}))
// 限制请求体的最大大小为 5MB
app.use(express.json({ limit: '5mb' }))
// 注册一个请求日志中间件,用于记录所有进入服务器的 HTTP 请求信息
app.use(requestLogger)

// ── 路由注册 ───────────────────────────────────────────────────
app.use('/health',        healthRouter)
app.use('/api/chat',      chatRouter)
app.use('/api/knowledge', knowledgeRouter)
app.use('/api/agent',     agentRouter)
app.use('/api/workflow',  workflowRouter)
app.use('/api/erp',       erpRouter)
app.use('/api/prompt',    promptRouter)
app.use('/api/monitor',   monitorRouter)


// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: { message: '接口不存在' } })
})

// 错误处理（必须在所有路由之后）
app.use(errorMiddleware)

// ── 启动 ───────────────────────────────────────────────────────
const server = app.listen(config.app.port, () => {
  logger.info('server started', {
    port: config.app.port,
    env:  config.app.env,
  })
  console.log(`\n🚀 WorkMind Server 已启动`)
  console.log(`   地址: http://localhost:${config.app.port}`)
  console.log(`   健康检查: http://localhost:${config.app.port}/health\n`)
})

// ── 优雅退出 ───────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info('shutdown', { signal })
  server.close(() => {
    logger.info('server closed')
    process.exit(0)
  })
  // 最多等 10s
  setTimeout(() => process.exit(1), 10000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { error: err.message })
  process.exit(1)
})

export default app
