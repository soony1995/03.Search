import Redis from 'ioredis'
import pg from 'pg'
import { config } from '../config.js'
import { indexPhoto, type PhotoDocument } from './elasticsearch.js'

const redis = new Redis(config.redisUrl)
const pool = new pg.Pool({ connectionString: config.aiPostgresUrl })

const CHANNEL_PHOTO_ANALYZED = 'photo:analyzed'
const CHANNEL_PHOTO_REINDEX = 'photo:reindex'

interface AnalyzedEvent {
    mediaId: string
    status: string
    faceCount: number
}

interface ReindexEvent {
    mediaId: string
}

export function startSubscriber(): void {
    const subscriber = new Redis(config.redisUrl)

    subscriber.subscribe(CHANNEL_PHOTO_ANALYZED, CHANNEL_PHOTO_REINDEX)
    console.log(`[Subscriber] Listening to ${CHANNEL_PHOTO_ANALYZED}, ${CHANNEL_PHOTO_REINDEX}`)

    subscriber.on('message', async (channel: string, message: string) => {
        if (channel !== CHANNEL_PHOTO_ANALYZED && channel !== CHANNEL_PHOTO_REINDEX) return

        try {
            const event: AnalyzedEvent | ReindexEvent = JSON.parse(message)
            console.log(`[Subscriber] Received (${channel}): ${event.mediaId}`)

            if (channel === CHANNEL_PHOTO_ANALYZED) {
                const analyzed = event as AnalyzedEvent
                if (analyzed.status !== 'DONE') {
                    console.log(`[Subscriber] Skipping (status: ${analyzed.status})`)
                    return
                }
            }

            // Fetch full data from AI database
            const photoDoc = await fetchPhotoData(event.mediaId)

            if (photoDoc) {
                await indexPhoto(photoDoc)
            }
        } catch (error) {
            console.error('[Subscriber] Error:', error)
        }
    })
}

async function fetchPhotoData(mediaId: string): Promise<PhotoDocument | null> {
    const client = await pool.connect()

    try {
        // Get analysis result
        const analysisResult = await client.query(`
      SELECT media_id, owner_id, face_count, taken_at, latitude, longitude, analyzed_at
      FROM analysis_results
      WHERE media_id = $1
    `, [mediaId])

        if (analysisResult.rows.length === 0) {
            console.log(`[Subscriber] No analysis found for: ${mediaId}`)
            return null
        }

        const analysis = analysisResult.rows[0]

        // Get persons linked to this photo
        const personsResult = await client.query(`
      SELECT p.id as person_id, p.name
      FROM photo_persons pp
      JOIN persons p ON pp.person_id = p.id
      WHERE pp.media_id = $1
    `, [mediaId])

        const doc: PhotoDocument = {
            mediaId: analysis.media_id,
            ownerId: analysis.owner_id,
            faceCount: analysis.face_count || 0,
            analyzedAt: analysis.analyzed_at?.toISOString() || new Date().toISOString(),
            persons: personsResult.rows.map((row: any) => ({
                personId: row.person_id,
                name: row.name
            }))
        }

        // Add optional fields
        if (analysis.taken_at) {
            doc.takenAt = analysis.taken_at.toISOString()
        }

        if (analysis.latitude && analysis.longitude) {
            doc.location = {
                lat: analysis.latitude,
                lon: analysis.longitude
            }
        }

        return doc
    } finally {
        client.release()
    }
}
