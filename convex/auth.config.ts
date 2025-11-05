export default {
  providers: [
    {
      domain: process.env.AUTH0_DOMAIN,
      applicationID: process.env.AUTH0_AUDIENCE ?? `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    },
  ],
};
