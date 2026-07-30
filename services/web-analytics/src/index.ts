import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { checkUrl, getUrlData } from './lib/util'
import { insertAndReturnId, insert } from './lib/dbutil'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.text('web-analytics ok'))
app.use('/api/*', cors())

app.post('/api/visit', async (c) => {
  const retObj = { ret: 'ERROR', data: null, message: 'Error, Internal Server Error' }
  try {
    const visitorIP = c.req.header('CF-Connecting-IP')
    const body = await c.req.json()
    const hostname = body.hostname
    const url_path = body.url
    const referrer = body.referrer
    const pv = body.pv
    const uv = body.uv
    const spv = body.spv
    const suv = body.suv
    let referrer_path = ''
    let referrer_domain = ''
    if (referrer && checkUrl(referrer)) {
      const referrerData = getUrlData(referrer)
      referrer_domain = referrerData.hostname
      referrer_path = referrerData.pathname
    }
    const website = await c.env.DB.prepare('select id, domain from t_website where domain = ?')
      .bind(hostname)
      .first()
    let websiteId: number
    if (website) {
      await insert(
        c.env.DB,
        'insert into t_web_visitor (website_id, url_path, referrer_domain, referrer_path, visitor_ip) values(?, ?, ?, ?, ?)',
        [website.id, url_path, referrer_domain, referrer_path, visitorIP]
      )
      websiteId = Number(website.id)
    } else {
      websiteId = await insertAndReturnId(c.env.DB, 'insert into t_website (name, domain) values(?,?)', [
        hostname.split('.').join('_'),
        hostname,
      ])
      await insert(
        c.env.DB,
        'insert into t_web_visitor (website_id, url_path, referrer_domain, referrer_path, visitor_ip) values(?, ?, ?, ?, ?)',
        [websiteId, url_path, referrer_domain, referrer_path, visitorIP]
      )
    }
    const resData: { pv?: number; uv?: number; spv?: number; suv?: number } = {}
    if (pv) {
      const total = await c.env.DB.prepare(
        'SELECT COUNT(*) AS total from t_web_visitor where website_id = ? and url_path = ?'
      )
        .bind(websiteId, url_path)
        .first('total')
      resData['pv'] = Number(total)
    }
    if (uv) {
      const total = await c.env.DB.prepare(
        'SELECT COUNT(*) AS total from (select DISTINCT visitor_ip from t_web_visitor where website_id = ? and url_path = ?) t'
      )
        .bind(websiteId, url_path)
        .first('total')
      resData['uv'] = Number(total)
    }
    if (spv) {
      const total = await c.env.DB.prepare('SELECT COUNT(*) AS total from t_web_visitor where website_id = ?')
        .bind(websiteId)
        .first('total')
      resData['spv'] = Number(total)
    }
    if (suv) {
      const total = await c.env.DB.prepare(
        'SELECT COUNT(*) AS total from (select DISTINCT visitor_ip from t_web_visitor where website_id = ?) t'
      )
        .bind(websiteId)
        .first('total')
      resData['suv'] = Number(total)
    }
    return c.json({ ret: 'OK', data: resData })
  } catch (e) {
    console.error(e)
    return c.json(retObj)
  }
})

/** 只读批量查询路径 PV，不写入访客（用于首页/列表卡片） */
app.post('/api/pv', async (c) => {
  const retObj = { ret: 'ERROR', data: null, message: 'Error, Internal Server Error' }
  try {
    const body = await c.req.json()
    const hostname = body.hostname
    const paths: unknown = body.paths
    if (!hostname || !Array.isArray(paths) || paths.length === 0) {
      return c.json({ ret: 'ERROR', data: null, message: 'hostname and paths required' })
    }
    const uniquePaths = [
      ...new Set(
        paths
          .filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length < 2048)
          .slice(0, 50)
      ),
    ]
    if (uniquePaths.length === 0) {
      return c.json({ ret: 'ERROR', data: null, message: 'no valid paths' })
    }
    const website = await c.env.DB.prepare('select id from t_website where domain = ?')
      .bind(hostname)
      .first('id')
    const counts: Record<string, number> = {}
    for (const p of uniquePaths) {
      counts[p] = 0
    }
    if (!website) {
      return c.json({ ret: 'OK', data: counts })
    }
    const websiteId = Number(website)
    const placeholders = uniquePaths.map(() => '?').join(',')
    const rows = await c.env.DB.prepare(
      `SELECT url_path, COUNT(*) AS total FROM t_web_visitor WHERE website_id = ? AND url_path IN (${placeholders}) GROUP BY url_path`
    )
      .bind(websiteId, ...uniquePaths)
      .all()
    for (const row of rows.results || []) {
      const urlPath = String((row as { url_path: string }).url_path)
      counts[urlPath] = Number((row as { total: number }).total)
    }
    return c.json({ ret: 'OK', data: counts })
  } catch (e) {
    console.error(e)
    return c.json(retObj)
  }
})

app.onError((err, c) => {
  console.error(`${err}`)
  return c.text(err.toString())
})

app.notFound((c) => c.text('Not found', 404))
export default app
