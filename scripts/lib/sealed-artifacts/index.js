const contract = require("./contract");
const { createSealedArtifactsService } = require("./service");
const {
  createSupabaseRegistryAdapter,
  createSupabaseSealedArtifactAdapters,
  createSupabaseStorageAdapter,
} = require("./supabase-adapters");

module.exports = {
  ...contract,
  createSealedArtifactsService,
  createSupabaseRegistryAdapter,
  createSupabaseSealedArtifactAdapters,
  createSupabaseStorageAdapter,
};
