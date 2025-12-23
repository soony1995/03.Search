import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { searchPhotos, suggestPersonNames } from '../services/elasticsearch.js'

const router = Router()

const searchQuerySchema = z.object({
    person: z.string().optional(),
    year: z.coerce.number().int().min(1900).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    page: z.coerce.number().int().min(0).default(0),
    size: z.coerce.number().int().min(1).max(100).default(20),
})

function ensureUser(req: Request): string {
    const userId = req.headers['x-user-id']
    if (!userId || typeof userId !== 'string') {
        throw new Error('Unauthorized')
    }
    return userId
}

// Search photos
router.get('/photos', async (req: Request, res: Response) => {
    try {
        const userId = ensureUser(req)

        const query = searchQuerySchema.safeParse(req.query)
        if (!query.success) {
            return res.status(400).json({ message: query.error.message })
        }

        const result = await searchPhotos({
            ownerId: userId,
            personName: query.data.person,
            year: query.data.year,
            month: query.data.month,
            page: query.data.page,
            size: query.data.size,
        })

        return res.json(result)
    } catch (error) {
        if ((error as Error).message === 'Unauthorized') {
            return res.status(401).json({ message: 'Unauthorized' })
        }
        console.error('[Search] Error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
})

// Autocomplete suggestions
router.get('/photos/suggestions', async (req: Request, res: Response) => {
    try {
        const userId = ensureUser(req)
        const prefix = typeof req.query.q === 'string' ? req.query.q : ''
        
        const suggestions = await suggestPersonNames(userId, prefix)
        return res.json(suggestions)
    } catch (error) {
         if ((error as Error).message === 'Unauthorized') {
            return res.status(401).json({ message: 'Unauthorized' })
        }
        console.error('[Search Suggest] Error:', error)
        return res.status(500).json({ message: 'Internal server error' })
    }
})

export default router
