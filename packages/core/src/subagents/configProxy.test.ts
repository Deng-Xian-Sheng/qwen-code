/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { createSubagentConfigProxy } from './configProxy.js';
import type { Config } from '../config/config.js';
import { AuthType } from '../core/contentGenerator.js';

describe('createSubagentConfigProxy', () => {
  it('should return subagent model from getModel()', () => {
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('main-model'),
      getAllConfiguredModels: vi.fn().mockReturnValue([
        { id: 'main-model', authType: AuthType.USE_OPENAI, isAvailable: true },
        {
          id: 'subagent-model',
          authType: AuthType.USE_OPENAI,
          isAvailable: false,
        },
      ]),
      getContentGeneratorConfig: vi.fn().mockReturnValue({
        model: 'main-model',
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        authType: AuthType.USE_OPENAI,
        modalities: { image: false },
      }),
    } as unknown as Config;

    const proxy = createSubagentConfigProxy(mockConfig, {
      model: 'subagent-model',
    });

    expect(proxy.getModel()).toBe('subagent-model');
    expect(mockConfig.getModel).not.toHaveBeenCalled();
  });

  it('should share apiKey and baseUrl from original config', () => {
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('main-model'),
      getAllConfiguredModels: vi.fn().mockReturnValue([]),
      getContentGeneratorConfig: vi.fn().mockReturnValue({
        model: 'main-model',
        apiKey: 'test-key',
        apiKeyEnvKey: 'TEST_API_KEY',
        baseUrl: 'https://api.example.com',
        authType: AuthType.USE_OPENAI,
      }),
    } as unknown as Config;

    const proxy = createSubagentConfigProxy(mockConfig, {
      model: 'subagent-model',
    });

    const contentGeneratorConfig = proxy.getContentGeneratorConfig();
    expect(contentGeneratorConfig.apiKey).toBe('test-key');
    expect(contentGeneratorConfig.apiKeyEnvKey).toBe('TEST_API_KEY');
    expect(contentGeneratorConfig.baseUrl).toBe('https://api.example.com');
    expect(contentGeneratorConfig.model).toBe('subagent-model');
  });

  it('should derive modalities from subagent model', () => {
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('main-model'),
      getAllConfiguredModels: vi.fn().mockReturnValue([]),
      getContentGeneratorConfig: vi.fn().mockReturnValue({
        model: 'main-model',
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        authType: AuthType.USE_OPENAI,
        modalities: { image: false },
      }),
    } as unknown as Config;

    const proxy = createSubagentConfigProxy(mockConfig, {
      model: 'qwen3.5-plus',
    });

    const contentGeneratorConfig = proxy.getContentGeneratorConfig();
    expect(contentGeneratorConfig.modalities).toEqual({
      image: true,
      video: true,
    });
  });

  it('should mark subagent model as available in getAllConfiguredModels', () => {
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('main-model'),
      getAllConfiguredModels: vi.fn().mockReturnValue([
        { id: 'main-model', authType: AuthType.USE_OPENAI, isAvailable: true },
        {
          id: 'subagent-model',
          authType: AuthType.USE_OPENAI,
          isAvailable: false,
        },
      ]),
      getContentGeneratorConfig: vi.fn().mockReturnValue({
        model: 'main-model',
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        authType: AuthType.USE_OPENAI,
      }),
    } as unknown as Config;

    const proxy = createSubagentConfigProxy(mockConfig, {
      model: 'subagent-model',
    });

    const allModels = proxy.getAllConfiguredModels();
    const subagentModelInfo = allModels.find((m) => m.id === 'subagent-model');
    expect(subagentModelInfo?.isAvailable).toBe(true);
  });

  it('should use custom modalities when provided', () => {
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('main-model'),
      getAllConfiguredModels: vi.fn().mockReturnValue([]),
      getContentGeneratorConfig: vi.fn().mockReturnValue({
        model: 'main-model',
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        authType: AuthType.USE_OPENAI,
        modalities: { image: false },
      }),
    } as unknown as Config;

    const customModalities = { image: true, pdf: true };
    const proxy = createSubagentConfigProxy(mockConfig, {
      model: 'custom-model',
      modalities: customModalities,
    });

    const contentGeneratorConfig = proxy.getContentGeneratorConfig();
    expect(contentGeneratorConfig.modalities).toEqual(customModalities);
  });

  it('should use custom contextWindowSize when provided', () => {
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('main-model'),
      getAllConfiguredModels: vi.fn().mockReturnValue([]),
      getContentGeneratorConfig: vi.fn().mockReturnValue({
        model: 'main-model',
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        authType: AuthType.USE_OPENAI,
        contextWindowSize: 8192,
      }),
    } as unknown as Config;

    const proxy = createSubagentConfigProxy(mockConfig, {
      model: 'subagent-model',
      contextWindowSize: 32768,
    });

    const contentGeneratorConfig = proxy.getContentGeneratorConfig();
    expect(contentGeneratorConfig.contextWindowSize).toBe(32768);
  });

  it('should fallback to original contextWindowSize when not provided', () => {
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('main-model'),
      getAllConfiguredModels: vi.fn().mockReturnValue([]),
      getContentGeneratorConfig: vi.fn().mockReturnValue({
        model: 'main-model',
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        authType: AuthType.USE_OPENAI,
        contextWindowSize: 8192,
      }),
    } as unknown as Config;

    const proxy = createSubagentConfigProxy(mockConfig, {
      model: 'subagent-model',
    });

    const contentGeneratorConfig = proxy.getContentGeneratorConfig();
    expect(contentGeneratorConfig.contextWindowSize).toBe(8192);
  });

  it('should preserve other config properties', () => {
    const mockConfig = {
      getModel: vi.fn().mockReturnValue('main-model'),
      getAllConfiguredModels: vi.fn().mockReturnValue([]),
      getContentGeneratorConfig: vi.fn().mockReturnValue({
        model: 'main-model',
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        authType: AuthType.USE_OPENAI,
        customHeaders: { 'X-Custom': 'header' },
        reasoning: { effort: 'high' },
      }),
    } as unknown as Config;

    const proxy = createSubagentConfigProxy(mockConfig, {
      model: 'subagent-model',
    });

    const contentGeneratorConfig = proxy.getContentGeneratorConfig();
    expect(contentGeneratorConfig.customHeaders).toEqual({
      'X-Custom': 'header',
    });
    expect(contentGeneratorConfig.reasoning).toEqual({ effort: 'high' });
  });
});
