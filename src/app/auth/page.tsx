"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function AuthPage() {
  const { loginWithRedirect, isLoading: auth0Loading } = useAuth0();
  const { isAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const router = useRouter();

  // Redirect to dashboard when authenticated
  useEffect(() => {
    if (!convexLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, convexLoading, router]);

  const handleLogin = () => {
    loginWithRedirect({
      appState: {
        returnTo: "/dashboard",
      },
    });
  };

  const isLoading = auth0Loading || convexLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Sora</CardTitle>
          <CardDescription>
            Manage your articles and reading list
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground text-center">
            Sign in to save articles and sync across devices
          </p>

          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Spinner />
                Loading...
              </>
            ) : (
              "Continue with Auth0"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
