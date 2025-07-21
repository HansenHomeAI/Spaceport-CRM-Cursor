import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from "amazon-cognito-identity-js"
import { awsConfig } from "./aws-config"

export interface AuthUser {
  id: string
  email: string
  name: string
  accessToken: string
}

export interface AuthResult {
  success: boolean
  message: string
  user?: AuthUser
}

class CognitoAuthService {
  private userPool: CognitoUserPool | null = null

  constructor() {
    if (typeof window !== "undefined" && awsConfig.userPoolId && awsConfig.userPoolClientId) {
      this.userPool = new CognitoUserPool({
        UserPoolId: awsConfig.userPoolId,
        ClientId: awsConfig.userPoolClientId,
      })
    }
  }

  async signUp(email: string, password: string, name: string): Promise<AuthResult> {
    if (!this.userPool) {
      return { success: false, message: "User pool not configured" }
    }

    return new Promise((resolve) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: "email",
          Value: email,
        }),
        new CognitoUserAttribute({
          Name: "name",
          Value: name,
        }),
      ]

      this.userPool!.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          resolve({
            success: false,
            message: err.message || "Sign up failed",
          })
          return
        }

        resolve({
          success: true,
          message: "Sign up successful! Please check your email for verification code.",
        })
      })
    })
  }

  async confirmSignUp(email: string, code: string): Promise<AuthResult> {
    if (!this.userPool) {
      return { success: false, message: "User pool not configured" }
    }

    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool!,
      })

      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          resolve({
            success: false,
            message: err.message || "Confirmation failed",
          })
          return
        }

        resolve({
          success: true,
          message: "Account confirmed successfully! You can now sign in.",
        })
      })
    })
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!this.userPool) {
      return { success: false, message: "User pool not configured" }
    }

    return new Promise((resolve) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      })

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool!,
      })

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const accessToken = result.getAccessToken().getJwtToken()
          const payload = result.getAccessToken().payload

          resolve({
            success: true,
            message: "Sign in successful!",
            user: {
              id: payload.sub,
              email: payload.email || email,
              name: payload.name || email.split("@")[0],
              accessToken,
            },
          })
        },
        onFailure: (err) => {
          resolve({
            success: false,
            message: err.message || "Sign in failed",
          })
        },
        newPasswordRequired: () => {
          resolve({
            success: false,
            message: "New password required",
          })
        },
      })
    })
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!this.userPool) {
      return null
    }

    return new Promise((resolve) => {
      const cognitoUser = this.userPool!.getCurrentUser()

      if (!cognitoUser) {
        resolve(null)
        return
      }

      cognitoUser.getSession((err: any, session: any) => {
        if (err || !session.isValid()) {
          resolve(null)
          return
        }

        const accessToken = session.getAccessToken().getJwtToken()
        const payload = session.getAccessToken().payload

        resolve({
          id: payload.sub,
          email: payload.email,
          name: payload.name || payload.email?.split("@")[0] || "User",
          accessToken,
        })
      })
    })
  }

  signOut(): void {
    if (!this.userPool) {
      return
    }

    const cognitoUser = this.userPool.getCurrentUser()
    if (cognitoUser) {
      cognitoUser.signOut()
    }
  }
}

export const CognitoAuth = new CognitoAuthService()
