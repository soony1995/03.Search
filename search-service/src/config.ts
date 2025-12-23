import { z } from 'zod'

const envSchema = z.object({
    PORT: z.coerce.number().default(4002),
    ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    AI_POSTGRES_URL: z.string().default('postgres://ai:ai_password@localhost:5433/ai_db'),
    ELASTICSEARCH_REINDEX: z.string().optional().default('false'),
    SUGGEST_MIN_PREFIX: z.coerce.number().int().min(1).default(1),
    SUGGEST_MAX_PREFIX: z.coerce.number().int().min(1).default(50),
})

const rawConfig = envSchema.parse(process.env)

export const config = {
    port: rawConfig.PORT,
    elasticsearchUrl: rawConfig.ELASTICSEARCH_URL,
    redisUrl: rawConfig.REDIS_URL,
    aiPostgresUrl: rawConfig.AI_POSTGRES_URL,
    elasticsearchReindex: rawConfig.ELASTICSEARCH_REINDEX.toLowerCase() === 'true',
    suggestMinPrefix: rawConfig.SUGGEST_MIN_PREFIX,
    suggestMaxPrefix: Math.max(rawConfig.SUGGEST_MAX_PREFIX, rawConfig.SUGGEST_MIN_PREFIX),
}
