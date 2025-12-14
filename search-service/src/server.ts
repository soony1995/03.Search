import express from 'express'
import { config } from './config.js'
import { initElasticsearch, createPhotoIndex } from './services/elasticsearch.js'
import { startSubscriber } from './services/subscriber.js'
import searchRoutes from './routes/search.js'

const app = express()

app.use(express.json())

// Routes
app.use('/search', searchRoutes)

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})

async function start() {
    try {
        // Initialize Elasticsearch
        await initElasticsearch()
        await createPhotoIndex()
        console.log('[Search] Elasticsearch initialized')

        // Start Redis subscriber for indexing
        startSubscriber()
        console.log('[Search] Redis subscriber started')

        // Start server
        app.listen(config.port, () => {
            console.log(`[Search] Server running on port ${config.port}`)
        })
    } catch (error) {
        console.error('[Search] Failed to start:', error)
        process.exit(1)
    }
}

start()
