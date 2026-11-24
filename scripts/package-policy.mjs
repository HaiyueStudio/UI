export function parseNpmPackResult(output, packageName) {
  const result = JSON.parse(output);
  const pack = Array.isArray(result) ? result.find(item => item?.name === packageName) : result?.[packageName];
  if (!pack || pack.name !== packageName || typeof pack.filename !== 'string' || !Array.isArray(pack.files)) {
    throw new Error(`Invalid npm pack result for ${packageName}`);
  }
  return pack;
}

export function matchesPackageGlob(path, glob) {
  let pattern = '^';
  for (let index = 0; index < glob.length; index++) {
    const character = glob[index];
    if (character === '*' && glob[index + 1] === '*') {
      if (glob[index + 2] === '/') {
        pattern += '(?:.*/)?';
        index += 2;
      } else {
        pattern += '.*';
        index++;
      }
    } else if (character === '*') {
      pattern += '[^/]*';
    } else {
      pattern += escapeRegExp(character);
    }
  }
  return new RegExp(`${pattern}$`).test(path);
}

function escapeRegExp(character) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}
