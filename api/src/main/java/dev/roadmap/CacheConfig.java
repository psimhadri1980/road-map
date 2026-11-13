package dev.roadmap;

import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.cache.interceptor.LoggingCacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;
import org.springframework.data.redis.serializer.RedisSerializer;

/**
 * Cache settings (T017, FR-007, FR-008). Values are the document text, readable in Redis, and never
 * expire: roadmaps cannot change in this feature (spec 004 adds eviction with writes). A cache
 * failure is logged and the request goes on to the database; Redis down is not a request failure.
 */
@Configuration
public class CacheConfig implements CachingConfigurer {

  @Bean
  RedisCacheConfiguration redisCacheConfiguration() {
    return RedisCacheConfiguration.defaultCacheConfig()
        .serializeValuesWith(SerializationPair.fromSerializer(RedisSerializer.string()))
        .disableCachingNullValues();
  }

  @Override
  public CacheErrorHandler errorHandler() {
    return new LoggingCacheErrorHandler();
  }
}
