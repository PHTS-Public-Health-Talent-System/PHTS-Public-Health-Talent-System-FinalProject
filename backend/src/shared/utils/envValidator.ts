/**
 * Environment Variable Validator
 *
 * Validates required environment variables at application startup
 * Prevents runtime errors due to missing or invalid configuration
 */

interface EnvConfig {
  [key: string]: {
    required: boolean;
    defaultValue?: string;
    validator?: (value: string) => boolean;
    errorMessage?: string;
  };
}

const ENV_CONFIG: EnvConfig = {
  // Database Configuration
  DB_HOST: {
    required: true,
    errorMessage: "Database host is required",
  },
  DB_PORT: {
    required: true,
    validator: (val) => /^\d+$/.test(val) && parseInt(val) > 0,
    errorMessage: "DB_PORT must be a valid port number",
  },
  DB_USER: {
    required: true,
    errorMessage: "Database user is required",
  },
  DB_PASSWORD: {
    required: true,
    errorMessage: "Database password is required",
  },
  DB_NAME: {
    required: true,
    errorMessage: "Database name is required",
  },

  // JWT Configuration
  JWT_SECRET: {
    required: true,
    validator: (val) => val.length >= 32,
    errorMessage: "JWT_SECRET must be at least 32 characters long",
  },
  JWT_EXPIRES_IN: {
    required: false,
    defaultValue: "24h",
  },

  // Server Configuration
  PORT: {
    required: false,
    defaultValue: "3001",
    validator: (val) => /^\d+$/.test(val) && parseInt(val) > 0,
    errorMessage: "PORT must be a valid port number",
  },
  NODE_ENV: {
    required: false,
    defaultValue: "development",
    validator: (val) =>
      ["development", "production", "test"].includes(val),
    errorMessage:
      "NODE_ENV must be one of: development, production, test",
  },

  // Frontend URL (optional, but good to validate format if provided)
  FRONTEND_URL: {
    required: false,
    validator: (val) => {
      if (!val) return true;
      return val
        .split(",")
        .every((url) => {
          try {
            new URL(url.trim());
            return true;
          } catch {
            return false;
          }
        });
    },
    errorMessage:
      "FRONTEND_URL must be a valid comma-separated list of URLs",
  },

  // Redis Configuration (optional)
  REDIS_HOST: {
    required: false,
    defaultValue: "127.0.0.1",
  },
  REDIS_PORT: {
    required: false,
    defaultValue: "6379",
    validator: (val) => /^\d+$/.test(val) && parseInt(val) > 0,
    errorMessage: "REDIS_PORT must be a valid port number",
  },

  // Rate Limiting (optional with defaults)
  RATE_LIMIT_WINDOW_MS: {
    required: false,
    defaultValue: "900000", // 15 minutes
    validator: (val) => /^\d+$/.test(val),
    errorMessage: "RATE_LIMIT_WINDOW_MS must be a number in milliseconds",
  },
  RATE_LIMIT_MAX: {
    required: false,
    defaultValue: "300",
    validator: (val) => /^\d+$/.test(val) && parseInt(val) > 0,
    errorMessage: "RATE_LIMIT_MAX must be a positive number",
  },

  // Auth Rate Limiting (optional with defaults)
  AUTH_RATE_LIMIT_WINDOW_MS: {
    required: false,
    defaultValue: "900000", // 15 minutes
    validator: (val) => /^\d+$/.test(val),
    errorMessage:
      "AUTH_RATE_LIMIT_WINDOW_MS must be a number in milliseconds",
  },
  AUTH_RATE_LIMIT_MAX: {
    required: false,
    defaultValue: "5",
    validator: (val) => /^\d+$/.test(val) && parseInt(val) > 0,
    errorMessage: "AUTH_RATE_LIMIT_MAX must be a positive number",
  },
};

/**
 * Validate all environment variables
 * Throws error if any required variable is missing or invalid
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  for (const [key, config] of Object.entries(ENV_CONFIG)) {
    const value = process.env[key];

    // Check if required variable is missing
    if (!value && config.required) {
      errors.push(
        config.errorMessage ||
          `${key} environment variable is required`,
      );
      continue;
    }

    // Skip validation if value is not provided and has a default
    if (!value && !config.required) {
      continue;
    }

    // Validate value format if validator provided
    if (value && config.validator && !config.validator(value)) {
      errors.push(
        config.errorMessage ||
          `${key} has an invalid value: ${value}`,
      );
    }
  }

  // Throw error with all validation failures
  if (errors.length > 0) {
    const errorMessage =
      "Environment variable validation failed:\n" +
      errors.map((e) => `  - ${e}`).join("\n");
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  console.log("[Config] Environment variables validated successfully");
}

/**
 * Get environment variable with optional default
 * Ensures variable is validated and returns proper type
 */
export function getEnvVariable(
  key: string,
  defaultValue?: string,
): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(
      `Environment variable ${key} is not set and no default value provided`,
    );
  }
  return value;
}

/**
 * Get environment variable as a number
 */
export function getEnvNumber(
  key: string,
  defaultValue?: number,
): number {
  const value =
    process.env[key] || (defaultValue !== undefined ? defaultValue.toString() : undefined);
  if (!value) {
    throw new Error(
      `Environment variable ${key} is not set and no default value provided`,
    );
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(
      `Environment variable ${key} must be a number, got: ${value}`,
    );
  }
  return num;
}

/**
 * Get environment variable as a boolean
 */
export function getEnvBoolean(
  key: string,
  defaultValue: boolean = false,
): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}
