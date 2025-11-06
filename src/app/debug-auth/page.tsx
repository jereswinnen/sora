"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

export default function DebugAuthPage() {
  const { getAccessTokenSilently, isAuthenticated, user } = useAuth0();
  const [tokenInfo, setTokenInfo] = useState<any>(null);

  useEffect(() => {
    if (isAuthenticated) {
      getAccessTokenSilently({ detailedResponse: true })
        .then((response) => {
          // Decode the ID token
          const idToken = response.id_token;
          const parts = idToken.split(".");
          const payload = JSON.parse(atob(parts[1]));

          setTokenInfo({
            idToken,
            payload,
            fullResponse: response,
          });
        })
        .catch((err) => {
          console.error("Error getting token:", err);
          setTokenInfo({ error: err.message });
        });
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  if (!isAuthenticated) {
    return <div className="p-8">Not authenticated. Please log in first.</div>;
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Auth Debug Info</h1>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">User Info:</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>

      {tokenInfo && (
        <>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Token Payload:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(tokenInfo.payload, null, 2)}
            </pre>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Key Fields:</h2>
            <div className="bg-gray-100 p-4 rounded space-y-1">
              <p><strong>Issuer (iss):</strong> {tokenInfo.payload?.iss}</p>
              <p><strong>Audience (aud):</strong> {JSON.stringify(tokenInfo.payload?.aud)}</p>
              <p><strong>Subject (sub):</strong> {tokenInfo.payload?.sub}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Expected by Convex:</h2>
            <div className="bg-yellow-100 p-4 rounded space-y-1">
              <p><strong>Domain (issuer):</strong> https://jereswinnen.eu.auth0.com</p>
              <p><strong>ApplicationID (audience):</strong> convex</p>
            </div>
          </div>

          {tokenInfo.error && (
            <div className="bg-red-100 p-4 rounded">
              <strong>Error:</strong> {tokenInfo.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
