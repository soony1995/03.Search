import { Client } from '@elastic/elasticsearch'
import { config } from '../config.js'

const client = new Client({ node: config.elasticsearchUrl })

const PHOTO_INDEX = 'photos'

export async function initElasticsearch(): Promise<void> {
    const health = await client.cluster.health()
    console.log(`[ES] Cluster health: ${health.status}`)
}

export async function createPhotoIndex(): Promise<void> {
    const exists = await client.indices.exists({ index: PHOTO_INDEX })

    if (!exists) {
        await client.indices.create({
            index: PHOTO_INDEX,
            body: {
                settings: {
                    analysis: {
                        analyzer: {
                            korean: {
                                type: 'custom',
                                tokenizer: 'nori_tokenizer',
                                filter: ['lowercase']
                            }
                        }
                    }
                },
                mappings: {
                    properties: {
                        mediaId: { type: 'keyword' },
                        ownerId: { type: 'keyword' },
                        takenAt: { type: 'date' },
                        analyzedAt: { type: 'date' },
                        location: { type: 'geo_point' },
                        faceCount: { type: 'integer' },
                        persons: {
                            type: 'nested',
                            properties: {
                                personId: { type: 'keyword' },
                                name: { type: 'text', analyzer: 'korean' }
                            }
                        }
                    }
                }
            }
        })
        console.log(`[ES] Created index: ${PHOTO_INDEX}`)
    }
}

export interface PhotoDocument {
    mediaId: string
    ownerId: string
    takenAt?: string
    analyzedAt: string
    location?: { lat: number; lon: number }
    faceCount: number
    persons: Array<{ personId: string; name: string }>
}

export async function indexPhoto(doc: PhotoDocument): Promise<void> {
    await client.index({
        index: PHOTO_INDEX,
        id: doc.mediaId,
        body: doc
    })
    console.log(`[ES] Indexed photo: ${doc.mediaId}`)
}

export interface SearchParams {
    ownerId: string
    personName?: string
    year?: number
    month?: number
    page?: number
    size?: number
}

export async function searchPhotos(params: SearchParams) {
    const must: any[] = [
        { term: { ownerId: params.ownerId } }
    ]

    // Person name filter (nested query)
    if (params.personName) {
        must.push({
            nested: {
                path: 'persons',
                query: {
                    match: { 'persons.name': params.personName }
                }
            }
        })
    }

    // Year filter
    if (params.year) {
        const startDate = `${params.year}-01-01`
        const endDate = `${params.year + 1}-01-01`
        must.push({
            range: {
                takenAt: { gte: startDate, lt: endDate }
            }
        })
    }

    // Month filter (requires year)
    if (params.year && params.month) {
        const startDate = `${params.year}-${String(params.month).padStart(2, '0')}-01`
        const nextMonth = params.month === 12 ? 1 : params.month + 1
        const nextYear = params.month === 12 ? params.year + 1 : params.year
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

        // Replace year filter with more specific month filter
        must[must.length - 1] = {
            range: {
                takenAt: { gte: startDate, lt: endDate }
            }
        }
    }

    const page = params.page ?? 0
    const size = params.size ?? 20

    const result = await client.search({
        index: PHOTO_INDEX,
        body: {
            query: { bool: { must } },
            from: page * size,
            size,
            sort: [{ takenAt: 'desc' }, { analyzedAt: 'desc' }]
        }
    })

    return {
        total: typeof result.hits.total === 'number'
            ? result.hits.total
            : result.hits.total?.value ?? 0,
        page,
        size,
        items: result.hits.hits.map((hit) => {
            const source = (hit._source ?? {}) as any
            const mediaId = source.mediaId ?? source.media_id ?? null

            return {
                ...source,
                ...(mediaId ? { mediaId } : {}),
                score: hit._score
            }
        })
    }
}
