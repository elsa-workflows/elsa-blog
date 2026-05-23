import { validateContent } from "./content.mjs";

try {
  const { posts, authors, errors } = await validateContent();

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }

    process.exit(1);
  }

  console.log(`Validated ${posts.length} post(s) and ${authors.size} author(s).`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
