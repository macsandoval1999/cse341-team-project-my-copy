# Team Practice Notes

## Pull Request Workflow
- Pull the latest `main` branch before starting a new branch.
- Include testing notes in every pull request.
- Ask for review in the team Microsoft Teams channel when a PR is ready.
- Add comments to the code to make it easier to review the code.

## Multiple Stale Local Host Servers
- As you know, we are to close our local dev servers when we are done testing.

- If you dont do this, the server/port could still be live without you even realising it.

- If you ever notice that your code changes don't seem to update on the front-end/browser, chances are you have a stale local host server that your browser is still displaying.

- Use the following to see what is using your desired port:

        Get-NetTCPConnection -LocalPort 3000 -State Listen |
            Select-Object LocalAddress, LocalPort, OwningProcess

- Use the following to close the stale local host server (PID is aka ownerProcess):

        Stop-Process -Id <PID> -Force

- Use the following to confirm the desired port is now free:

        Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue