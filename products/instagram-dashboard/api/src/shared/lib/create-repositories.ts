import type { PrismaClient } from '@prisma/client';

import { PrismaConnectionRequestRepository } from '../../account/repositories/connection-request/connection-request.prisma.repository.js';
import { PrismaInstagramRepository } from '../../account/repositories/instagram/index.js';
import { PrismaCarouselRepository } from '../../agent/repositories/carousel.repository.js';
import { PrismaChatMessageRepository } from '../../agent/repositories/chat-message.repository.js';
import { PrismaSuggestionRepository } from '../../agent/repositories/suggestion.repository.js';

export type { IChatMessageRepository } from '../../agent/repositories/chat-message.repository.js';
export type { ISuggestionRepository } from '../../agent/repositories/suggestion.repository.js';
export type { ICarouselRepository } from '../../agent/repositories/carousel.repository.js';

export interface Repositories {
  instagram: PrismaInstagramRepository;
  connectionRequest: PrismaConnectionRequestRepository;
  chatMessage: PrismaChatMessageRepository;
  suggestion: PrismaSuggestionRepository;
  carousel: PrismaCarouselRepository;
}

export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    instagram: new PrismaInstagramRepository(prisma),
    connectionRequest: new PrismaConnectionRequestRepository(prisma),
    chatMessage: new PrismaChatMessageRepository(prisma),
    suggestion: new PrismaSuggestionRepository(prisma),
    carousel: new PrismaCarouselRepository(prisma),
  };
}
