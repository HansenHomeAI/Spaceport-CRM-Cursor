import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js'
import { awsConfig } from './aws-config'

// Initialize Cognito User Pool (only if config is available)
let userPool: CognitoUserPool | null = null

if (awsConfig.userPoolId && awsConfig.userPoolClientId) {
  userPool = new CognitoUserPool({
    UserPoolId: awsConfig.userPoolId,
    ClientId: awsConfig.userPoolClientId,
  })
}

export interface AuthUser {
  id: string
  name: string
  email: string
  accessToken: string
  refreshToken: string
  isDemo?: boolean
}

export interface AuthResult {
  success: boolean
  message: string
  user?: AuthUser
}

class CognitoAuth {
  private currentUser: AuthUser | null = null

  // Get current user from localStorage or token
  getCurrentUser(): AuthUser | null {
    if (this.currentUser) {
      return this.currentUser
    }

    const savedUser = localStorage.getItem('spaceport_auth_user')
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        // Check if token is still valid
        if (this.isTokenValid(user.accessToken)) {
          this.currentUser = user
          return user
        } else {
          // Token expired, try to refresh
          this.refreshToken(user.refreshToken)
        }
      } catch (error) {
        console.error('Error parsing saved user:', error)
        localStorage.removeItem('spaceport_auth_user')
      }
    }
    return null
  }

  // Check if JWT token is valid
  private isTokenValid(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expiry = payload.exp * 1000 // Convert to milliseconds
      return Date.now() < expiry
    } catch {
      return false
    }
  }

  // Sign up new user
  async signUp(email: string, password: string, name: string): Promise<AuthResult> {
    if (!userPool) {
      return { success: false, message: "User pool not configured" }
    }

    return new Promise((resolve) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email,
        }),
        new CognitoUserAttribute({
          Name: 'given_name',
          Value: name.split(' ')[0] || name,
        }),
        new CognitoUserAttribute({
          Name: 'family_name',
          Value: name.split(' ').slice(1).join(' ') || '',
        }),
      ]

      userPool!.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          console.error('Sign up error:', err)
          resolve({
            success: false,
            message: err.message || 'Failed to create account',
          })
        } else {
          resolve({
            success: true,
            message: 'Account created successfully! Please check your email to verify your account.',
          })
        }
      })
    })
  }

  // Sign in user
  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!userPool) {
      return { success: false, message: "User pool not configured" }
    }

    return new Promise((resolve) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      })

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool!,
      })

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const user: AuthUser = {
            id: cognitoUser.getUsername(),
            name: email.split('@')[0], // Fallback name
            email: email,
            accessToken: result.getAccessToken().getJwtToken(),
            refreshToken: result.getRefreshToken().getToken(),
          }

          // Get user attributes for name
          cognitoUser.getUserAttributes((err, attributes) => {
            if (!err && attributes) {
              const givenName = attributes.find(attr => attr.getName() === 'given_name')?.getValue()
              const familyName = attributes.find(attr => attr.getName() === 'family_name')?.getValue()
              if (givenName || familyName) {
                user.name = [givenName, familyName].filter(Boolean).join(' ')
              }
            }
            
            this.currentUser = user
            localStorage.setItem('spaceport_auth_user', JSON.stringify(user))
            resolve({
              success: true,
              message: 'Signed in successfully!',
              user,
            })
          })
        },
        onFailure: (err) => {
          console.error('Sign in error:', err)
          resolve({
            success: false,
            message: err.message || 'Invalid email or password',
          })
        },
      })
    })
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    if (!userPool) {
      return { success: false, message: "User pool not configured" }
    }

    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: this.currentUser?.id || '',
        Pool: userPool!,
      })

      // Create CognitoRefreshToken object
      const { CognitoRefreshToken } = require('amazon-cognito-identity-js')
      const refreshTokenObj = new CognitoRefreshToken({ RefreshToken: refreshToken })

      cognitoUser.refreshSession(refreshTokenObj, (err, session) => {
        if (err) {
          console.error('Token refresh error:', err)
          this.signOut()
          resolve({
            success: false,
            message: 'Session expired. Please sign in again.',
          })
        } else {
          const user: AuthUser = {
            ...this.currentUser!,
            accessToken: session.getAccessToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
          }
          
          this.currentUser = user
          localStorage.setItem('spaceport_auth_user', JSON.stringify(user))
          resolve({
            success: true,
            message: 'Token refreshed',
            user,
          })
        }
      })
    })
  }

  // Sign out
  signOut(): void {
    if (this.currentUser && userPool) {
      const cognitoUser = new CognitoUser({
        Username: this.currentUser.id,
        Pool: userPool,
      })
      cognitoUser.signOut()
    }
    
    this.currentUser = null
    localStorage.removeItem('spaceport_auth_user')
  }

  // Get access token for API calls
  getAccessToken(): string | null {
    const user = this.getCurrentUser()
    return user?.accessToken || null
  }

  // Demo mode fallback
  signInDemo(): AuthUser {
    const demoUser: AuthUser = {
      id: 'demo-1',
      name: 'Demo User',
      email: 'demo@spaceport.com',
      accessToken: 'demo-token',
      refreshToken: 'demo-refresh',
      isDemo: true,
    }
    
    this.currentUser = demoUser
    localStorage.setItem('spaceport_auth_user', JSON.stringify(demoUser))
    return demoUser
  }
}

export const cognitoAuth = new CognitoAuth()
