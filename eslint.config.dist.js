import gsebuild from "@jon4hz/gsebuild/eslint";

export default [
  gsebuild.configs.dist,
  {
    files: ["build/"],
  },
];
