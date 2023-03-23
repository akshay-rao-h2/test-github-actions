const core = require('@actions/core');
const github = require('@actions/github');

try {
  // `who-to-greet` input defined in action metadata file
  const nameToGreet = core.getInput('who-to-greet');
  const PrLink = core.getInput('pr-link');
  console.log(`Hello ${nameToGreet}! ${PrLink}`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
//   const payload = JSON.stringify(github.context.payload, undefined, 2)
//   console.log(`The event payload: ${payload}`);

  const octokit = github.getOctokit(githubToken)

  const { data: pullRequest } = await octokit.rest.pulls.get({
      owner: 'akshay-rao-h2',
      repo: 'test-github-actions',
      pull_number: PrLink,
      mediaType: {
        format: 'diff'
      }
  });
  console.log('pullRequest is as', pullRequest)

} catch (error) {
  core.setFailed(error.message);
}