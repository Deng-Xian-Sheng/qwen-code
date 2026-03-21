/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type {
  ContentGenerator,
  InputModalities,
} from '../core/contentGenerator.js';
import { createContentGenerator } from '../core/contentGenerator.js';
import { defaultModalities } from '../core/modalityDefaults.js';

/**
 * Model override configuration for subagents.
 */
export interface SubagentModelOverride {
  model: string;
  contextWindowSize?: number;
  modalities?: InputModalities;
}

/**
 * Creates a proxy for Config that overrides model-related methods
 * to return subagent-specific values while sharing baseUrl and apiKey.
 *
 * @param originalConfig - The original runtime configuration
 * @param override - Model override settings for the subagent
 * @returns A proxied Config instance
 */
export function createSubagentConfigProxy(
  originalConfig: Config,
  override: SubagentModelOverride,
): Config {
  // Pre-compute modalities based on subagent model
  const modalities = override.modalities ?? defaultModalities(override.model);

  // Get original content generator config
  // Note: Task tool is called by the main agent after authentication,
  // so originalContentGeneratorConfig is guaranteed to be initialized.
  const originalContentGeneratorConfig =
    originalConfig.getContentGeneratorConfig()!;

  // Create a proxy for ContentGeneratorConfig
  const contentGeneratorConfigProxy = new Proxy(
    originalContentGeneratorConfig,
    {
      get(target, prop, receiver) {
        // Override model field to return subagent's model
        if (prop === 'model') {
          return override.model;
        }

        // Override modalities based on subagent's model
        if (prop === 'modalities') {
          return modalities;
        }

        // Override contextWindowSize if specified
        if (prop === 'contextWindowSize') {
          return override.contextWindowSize ?? target.contextWindowSize;
        }

        // For apiKey, baseUrl, authType, etc., use original values
        return Reflect.get(target, prop, receiver);
      },
    },
  );

  // Cache for the subagent's content generator (lazy initialization)
  let subagentContentGenerator: ContentGenerator | undefined;
  let contentGeneratorPromise: Promise<ContentGenerator> | undefined;

  // Async function to create subagent content generator with proxied config
  const createSubagentContentGenerator =
    async (): Promise<ContentGenerator> => {
      if (subagentContentGenerator) {
        return subagentContentGenerator;
      }
      if (contentGeneratorPromise) {
        return contentGeneratorPromise;
      }

      contentGeneratorPromise = (async () => {
        subagentContentGenerator = await createContentGenerator(
          contentGeneratorConfigProxy,
          configProxy,
        );
        return subagentContentGenerator;
      })();

      return contentGeneratorPromise;
    };

  // Create a proxy for Config
  const configProxy = new Proxy(originalConfig, {
    get(target, prop, receiver) {
      // Override getModel() to return subagent model
      if (prop === 'getModel') {
        return () => override.model;
      }

      // Override getContentGeneratorConfig to return proxied config
      if (prop === 'getContentGeneratorConfig') {
        return () => contentGeneratorConfigProxy;
      }

      // Also override direct property access if contentGeneratorConfig is accessed directly
      if (prop === 'contentGeneratorConfig') {
        return contentGeneratorConfigProxy;
      }

      // Override getContentGenerator to return subagent-specific generator
      if (prop === 'getContentGenerator') {
        return () => {
          // Return a proxy that lazily creates the subagent generator on first use
          if (!subagentContentGenerator && !contentGeneratorPromise) {
            // Start async creation but don't await here (sync context)
            void createSubagentContentGenerator();
          }

          // Return a proxy that delegates to the subagent generator when ready
          return new Proxy({} as ContentGenerator, {
            get(_genTarget, genProp) {
              // If generator is ready, delegate directly
              if (subagentContentGenerator) {
                const value = (
                  subagentContentGenerator as unknown as Record<string, unknown>
                )[genProp as string];
                if (typeof value === 'function') {
                  return value.bind(subagentContentGenerator);
                }
                return value;
              }

              // If still creating, return a function that waits and then calls
              if (
                typeof genProp === 'string' &&
                genProp !== 'then' &&
                genProp !== 'catch'
              ) {
                return async (...args: unknown[]) => {
                  const generator = await createSubagentContentGenerator();
                  const method = (
                    generator as unknown as Record<string, unknown>
                  )[genProp];
                  if (typeof method === 'function') {
                    return method.apply(generator, args);
                  }
                  throw new Error(`Method ${genProp} is not a function`);
                };
              }

              return undefined;
            },
          });
        };
      }

      // Override getAllConfiguredModels to mark current model as available
      if (prop === 'getAllConfiguredModels') {
        return (authTypes?: unknown[]) => {
          const allModels = target.getAllConfiguredModels(authTypes as never);
          return allModels.map((m) => ({
            ...m,
            isAvailable: m.id === override.model ? true : m.isAvailable,
          }));
        };
      }

      // Default: return original value
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  });

  return configProxy;
}
