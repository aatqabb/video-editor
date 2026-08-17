module.exports = {
  packagerConfig: {
    asar: true,
    name: 'VideoEditor',
    executableName: 'VideoEditor',
    prune: true,
    ignore: [
      /^\/\.github($|\/)/,
      /^\/scripts($|\/)/,
      /^\/src($|\/)/,
      /^\/public($|\/)/,
    ],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'VideoEditor',
        authors: 'aatqabb',
        description: 'A streamlined Premiere-style video editor for YouTube workflows.',
        setupExe: 'VideoEditor-Setup.exe',
        noMsi: true,
      },
    },
  ],
}
