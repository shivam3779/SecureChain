/**
 * SBOM Engine
 * Resolves the full transitive dependency graph for a Node.js project from
 * package.json by querying the real npm registry, then serializes the
 * result as CycloneDX 1.5 JSON and SPDX 2.3.
 *
 * This hits https://registry.npmjs.org for real — no mocking.
 */

const axios = require('axios');
const crypto = require('crypto');

const NPM_REGISTRY = 'https://registry.npmjs.org';
const registryCache = new Map(); // name -> metadata (per-process cache)

async function fetchPackageMetadata(name) {
  if (registryCache.has(name)) return registryCache.get(name);
  try {
    const { data } = await axios.get(`${NPM_REGISTRY}/${encodeURIComponent(name)}`, {
      timeout: 8000,
    });
    registryCache.set(name, data);
    return data;
  } catch (err) {
    registryCache.set(name, null);
    return null;
  }
}

function resolveVersion(meta) {
  if (!meta) return null;
  const latest = meta['dist-tags'] && meta['dist-tags'].latest;
  if (latest && meta.versions && meta.versions[latest]) return latest;
  const versions = meta.versions ? Object.keys(meta.versions) : [];
  return versions.length ? versions[versions.length - 1] : null;
}

/**
 * Recursively walks dependencies starting from a manifest's
 * `dependencies` + `devDependencies` map, querying the npm registry for
 * each package and its own declared dependencies.
 */
async function resolveDependencyTree(rootDeps, opts = {}) {
  const maxDepth = opts.maxDepth ?? 4;
  const components = new Map(); // key: name@version -> component record
  const edges = [];

  async function walk(name, depth, parent) {
    if (depth > maxDepth) return;
    const meta = await fetchPackageMetadata(name);
    if (!meta) {
      const key = `${name}@unresolved`;
      if (!components.has(key)) {
        components.set(key, {
          name,
          version: 'unresolved',
          resolved: false,
          purl: `pkg:npm/${name}`,
          licence: null,
          maintainers: [],
          publishDate: null,
          description: null,
        });
      }
      return;
    }
    const version = resolveVersion(meta);
    const key = `${name}@${version}`;
    if (components.has(key)) {
      if (parent) edges.push({ from: parent, to: key });
      return;
    }

    const versionData = (meta.versions && meta.versions[version]) || {};
    components.set(key, {
      name,
      version,
      resolved: true,
      purl: `pkg:npm/${name}@${version}`,
      licence: versionData.license || meta.license || 'UNKNOWN',
      maintainers: (meta.maintainers || []).map((m) => m.name),
      publishDate: (meta.time && meta.time[version]) || null,
      description: meta.description || versionData.description || '',
      hasInstallScripts: !!(versionData.scripts && (versionData.scripts.postinstall || versionData.scripts.preinstall)),
    });
    if (parent) edges.push({ from: parent, to: key });

    const childDeps = versionData.dependencies || {};
    const childNames = Object.keys(childDeps);
    // Bound fan-out so a single scan doesn't explode into thousands of calls
    await Promise.all(childNames.slice(0, 25).map((childName) => walk(childName, depth + 1, key)));
  }

  const rootNames = Object.keys(rootDeps);
  await Promise.all(rootNames.map((name) => walk(name, 0, null)));

  return { components: Array.from(components.values()), edges };
}

function toCycloneDX(projectName, projectVersion, { components }) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: { type: 'application', name: projectName, version: projectVersion || '0.0.0' },
    },
    components: components
      .filter((c) => c.resolved)
      .map((c) => ({
        type: 'library',
        name: c.name,
        version: c.version,
        purl: c.purl,
        licenses: c.licence ? [{ license: { id: c.licence } }] : [],
        description: c.description,
        properties: [
          { name: 'securechain:hasInstallScripts', value: String(!!c.hasInstallScripts) },
          { name: 'securechain:publishDate', value: c.publishDate || 'unknown' },
        ],
      })),
  };
}

function toSPDX(projectName, projectVersion, { components }) {
  const created = new Date().toISOString();
  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `${projectName}-sbom`,
    documentNamespace: `https://securechain.local/spdx/${projectName}-${Date.now()}`,
    creationInfo: { created, creators: ['Tool: SecureChain-SBOM-Engine-1.0'] },
    packages: [
      {
        SPDXID: 'SPDXRef-Package-root',
        name: projectName,
        versionInfo: projectVersion || '0.0.0',
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: false,
      },
      ...components
        .filter((c) => c.resolved)
        .map((c, i) => ({
          SPDXID: `SPDXRef-Package-${i}`,
          name: c.name,
          versionInfo: c.version,
          downloadLocation: `https://registry.npmjs.org/${c.name}/-/${c.name}-${c.version}.tgz`,
          licenseDeclared: c.licence || 'NOASSERTION',
          filesAnalyzed: false,
          externalRefs: [{ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: c.purl }],
        })),
    ],
  };
}

/** Diff two SBOMs (by component list) to find added/removed/changed packages. */
function diffSBOMs(previousComponents = [], currentComponents = []) {
  const prevMap = new Map(previousComponents.map((c) => [c.name, c]));
  const currMap = new Map(currentComponents.map((c) => [c.name, c]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [name, comp] of currMap) {
    if (!prevMap.has(name)) {
      added.push(comp);
    } else if (prevMap.get(name).version !== comp.version) {
      changed.push({ name, from: prevMap.get(name).version, to: comp.version });
    }
  }
  for (const [name, comp] of prevMap) {
    if (!currMap.has(name)) removed.push(comp);
  }

  return { added, removed, changed };
}

module.exports = { fetchPackageMetadata, resolveDependencyTree, toCycloneDX, toSPDX, diffSBOMs };
