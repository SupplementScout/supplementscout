const contract = require("./contract");
const rollout = require("./rollout");
const { createSealedArtifactsService } = require("./service");
const {
  createSupabaseRegistryAdapter,
  createSupabaseSealedArtifactAdapters,
  createSupabaseStorageAdapter,
} = require("./supabase-adapters");

module.exports = {
  ...contract,
  ...rollout,
  createSealedArtifactsService,
  createSupabaseRegistryAdapter,
  createSupabaseSealedArtifactAdapters,
  createSupabaseStorageAdapter,
};
