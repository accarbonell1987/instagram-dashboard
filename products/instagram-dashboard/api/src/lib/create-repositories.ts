import type { PrismaClient } from '@prisma/client';

import { PrismaCarouselRepository } from '../repositories/carousel.repository.js';
import { PrismaChatMessageRepository } from '../repositories/chat-message.repository.js';
import { PrismaInstagramRepository } from '../repositories/instagram/index.js';
import { PrismaSuggestionRepository } from '../repositories/suggestion.repository.js';

export type { IChatMessageRepository } from '../repositories/chat-message.repository.js';
export type { ISuggestionRepository } from '../repositories/suggestion.repository.js';
export type { ICarouselRepository } from '../repositories/carousel.repository.js';

export interface Repositories {
  instagram: PrismaInstagramRepository;
  chatMessage: PrismaChatMessageRepository;
  suggestion: PrismaSuggestionRepository;
  carousel: PrismaCarouselRepository;
}

export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    instagram: new PrismaInstagramRepository(prisma),
    chatMessage: new PrismaChatMessageRepository(prisma),
    suggestion: new PrismaSuggestionRepository(prisma),
    carousel: new PrismaCarouselRepository(prisma),
  };
}
