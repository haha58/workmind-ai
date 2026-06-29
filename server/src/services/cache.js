// server/src/services/cache.js
// 精确缓存：相同的 system + message 直接返回缓存，不调 API
import crypto from 'crypto'
import { config } from '../config/index.js'

/**
 * 精确缓存类
 * 
 * 功能:
 * - 缓存相同的系统提示词 + 用户消息的响应结果
 * - 避免重复调用 AI API，节省 token 成本
 * - 提供缓存命中率统计和过期管理
 */
class ExactCache {
  /**
   * 构造函数：初始化缓存存储和统计数据
   */
  constructor() {
    // 缓存存储：key(MD5哈希) → { content(响应内容), ts(时间戳), tokens(消耗的token数) }
    this.store = new Map()
    
    // 缓存统计数据
    this.stats = {
      hits: 0,           // 缓存命中次数
      misses: 0,         // 缓存未命中次数
      savedTokens: 0,    // 通过缓存节省的 token 总量
    }
  }

  /**
   * 生成缓存键值
   * 使用 MD5 将 systemPrompt + message 组合转换为唯一的哈希值
   * 
   * @param {string} systemPrompt - 系统提示词
   * @param {string} message - 用户消息
   * @returns {string} MD5 哈希值(32位十六进制字符串)
   */
  _key(systemPrompt, message) {
    return crypto
      .createHash('md5')
      .update(`${systemPrompt || ''}||${message}`)  // 用 || 分隔避免冲突
      .digest('hex')
  }

  /**
   * 获取缓存
   * 
   * @param {string} systemPrompt - 系统提示词
   * @param {string} message - 用户消息
   * @returns {object|null} 缓存对象 { content, tokens, ts }，未命中或过期返回 null
   */
  get(systemPrompt, message) {
    const k = this._key(systemPrompt, message)
    const entry = this.store.get(k)

    // 缓存未命中
    if (!entry) {
      this.stats.misses++
      return null
    }

    // 检查是否过期(超过配置的 TTL 时间)
    if (Date.now() - entry.ts > config.cache.ttl) {
      this.store.delete(k)  // 删除过期缓存
      this.stats.misses++
      return null
    }

    // 缓存命中，更新统计
    this.stats.hits++
    this.stats.savedTokens += entry.tokens || 0
    return entry
  }

  /**
   * 设置缓存
   * 
   * @param {string} systemPrompt - 系统提示词
   * @param {string} message - 用户消息
   * @param {object} options - 缓存数据
   * @param {string} options.content - 响应内容
   * @param {number} options.tokens - 消耗的 token 数
   */
  set(systemPrompt, message, { content, tokens = 0 }) {
    const k = this._key(systemPrompt, message)
    this.store.set(k, { content, tokens, ts: Date.now() })

    // 缓存容量管理：超过 500 条时，清除最老的 50 条(简单 LRU 策略)
    if (this.store.size > 500) {
      const oldestKeys = [...this.store.entries()]
        .sort((a, b) => a[1].ts - b[1].ts)  // 按时间戳升序排序
        .slice(0, 50)                        // 取最老的 50 条
        .map(([k]) => k)
      oldestKeys.forEach(k => this.store.delete(k))
    }
  }

  /**
   * 计算缓存命中率
   * @returns {string} 命中率百分比字符串(如 "75.3%")
   */
  get hitRate() {
    const total = this.stats.hits + this.stats.misses
    return total === 0 ? '0%' : `${(this.stats.hits / total * 100).toFixed(1)}%`
  }

  /**
   * 获取完整的缓存统计信息
   * @returns {object} 包含缓存大小、命中/未命中次数、命中率、节省token数
   */
  getStats() {
    return {
      size:        this.store.size,       // 当前缓存条目数
      hits:        this.stats.hits,       // 命中次数
      misses:      this.stats.misses,     // 未命中次数
      hitRate:     this.hitRate,          // 命中率
      savedTokens: this.stats.savedTokens, // 节省的 token 总量
    }
  }
}

// 导出全局单例，整个应用共享同一个缓存实例
export const cache = new ExactCache()