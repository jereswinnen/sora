import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // With Auth0, return the user info directly from the identity token
    // The identity contains: subject, email, name, emailVerified, etc.
    return {
      _id: identity.subject as Id<"users">, // Use Auth0 subject as the ID
      _creationTime: Date.now(),
      email: identity.email,
      name: identity.name,
      emailVerificationTime: identity.emailVerified ? Date.now() : undefined,
    };
  },
});
