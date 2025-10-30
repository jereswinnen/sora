"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";

export default function AuthPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect to dashboard when authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      const message = err.message;

      // Map Convex Auth errors to user-friendly messages
      if (
        message.includes("InvalidAccountId") ||
        message.includes("InvalidSecret") ||
        message.includes("Invalid credentials")
      ) {
        return "Invalid email or password. Please check your credentials and try again.";
      }
      if (message.includes("Account with this email already exists")) {
        return "An account with this email already exists. Please sign in instead.";
      }
      if (message.includes("Email already in use")) {
        return "This email is already registered. Please sign in or use a different email.";
      }

      return message;
    }
    return "Authentication failed. Please try again.";
  };

  const handleSubmit = async (e: React.FormEvent, flow: "signIn" | "signUp") => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn("password", {
        email,
        password,
        flow,
      });
      // Don't manually redirect - let the useEffect handle it when auth state updates
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Sora</CardTitle>
          <CardDescription>
            Manage your articles and reading list
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="signin" className="w-full" onValueChange={() => setError("")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={(e) => handleSubmit(e, "signIn")} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={loading || !email || !password} className="w-full">
                  {loading ? (
                    <>
                      <Spinner />
                      Logging in
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={(e) => handleSubmit(e, "signUp")} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={loading || !email || !password} className="w-full">
                  {loading ? (
                    <>
                      <Spinner />
                      Creating account
                    </>
                  ) : (
                    "Sign Up"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
