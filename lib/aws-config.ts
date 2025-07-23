// AWS Configuration
export const awsConfig = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || "us-west-2",
  userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || "",
  userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || "",
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "",
}

// Validate configuration
export const validateConfig = () => {
  const missing = []
  if (!awsConfig.userPoolId) missing.push("NEXT_PUBLIC_USER_POOL_ID")
  if (!awsConfig.userPoolClientId) missing.push("NEXT_PUBLIC_USER_POOL_CLIENT_ID")
  if (!awsConfig.apiUrl) missing.push("NEXT_PUBLIC_API_URL")

  if (missing.length > 0) {
    console.warn("Missing AWS configuration:", missing)
    return false
  }
  return true
}

// Development fallback configuration
export const getDevelopmentConfig = () => {
  if (process.env.NODE_ENV === 'development') {
    return {
      region: "us-west-2",
      userPoolId: "us-west-2_placeholder",
      userPoolClientId: "placeholder",
      apiUrl: "http://localhost:3000/api",
    }
  }
  return awsConfig
}
