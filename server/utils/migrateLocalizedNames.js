// One-time migration for the ar/en localization of CardCategory.name,
// CardType.name, and CardTier.title (see cardCategory.model.js,
// cardType.model.js, cardTier.model.js). Before this, each was a single
// plain string; now they are { ar, en } objects. This copies the existing
// string value into ar (the app is Arabic-first) and leaves en empty for an
// admin to fill in via the panel.
//
// Uses the raw MongoDB driver rather than the Mongoose models, since by the
// time this needs to run the model files already declare the new nested
// shape - reading an old string-valued document through that schema would
// silently hydrate ar/en as undefined instead of surfacing the old value.
//
// Safe to re-run: only touches documents where the field is still a plain
// string, so an already-migrated document (or one created after this
// migration) is left untouched.
//
// Usage: node utils/migrateLocalizedNames.js
import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";

dotenv.config();

const migrateField = async (collectionName, field) => {
  const collection = mongoose.connection.db.collection(collectionName);
  const cursor = collection.find({ [field]: { $type: "string" } });

  let migrated = 0;
  for await (const doc of cursor) {
    const oldValue = doc[field] ?? "";
    await collection.updateOne(
      { _id: doc._id },
      { $set: { [field]: { ar: oldValue, en: "" } } },
    );
    migrated += 1;
  }

  console.log(
    `[migrateLocalizedNames] ${collectionName}.${field}: migrated ${migrated} document(s)`,
  );
};

const run = async () => {
  await connectDB();

  await migrateField("card_categories", "name");
  await migrateField("card_types", "name");
  await migrateField("card_tiers", "title");

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("[migrateLocalizedNames] failed:", err);
  process.exit(1);
});
