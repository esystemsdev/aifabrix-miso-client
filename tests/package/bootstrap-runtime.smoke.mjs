import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(".");
const temporary = mkdtempSync(join(tmpdir(), "miso-bootstrap-"));
const entry = join(root, "dist/bootstrap/index.js");
function run(script, env = {}, args = []) {
  const result = spawnSync(process.execPath, [...args, "-e", script], {
    cwd: temporary,
    encoding: "utf8",
    timeout: 10000,
    env: { PATH: process.env.PATH, ...env },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
const denyNetwork = `
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
Module._load = function(name, ...args) {
  if (name === '@azure/identity') throw new Error('Azure must not be loaded');
  return original.call(this, name, ...args);
};
const axios = require(${JSON.stringify(join(root, "node_modules/axios/dist/node/axios.cjs"))});
axios.post = () => { throw new Error('Broker must not be contacted'); };
require('node:http').request = require('node:https').request = () => { throw new Error('Network forbidden'); };
`;
try {
  writeFileSync(
    join(temporary, ".env"),
    "MISO_CLIENTID=dotenv-id\nMISO_CLIENTSECRET=dotenv-secret\nDATABASE_URL=dotenv-value\n",
  );
  for (const mode of [undefined, "local"]) {
    run(
      `${denyNetwork}
(async () => {
 const {initSecrets} = require(${JSON.stringify(entry)});
 const requests=[];
 axios.defaults.adapter=async config => {
   requests.push(config.url);
   assert.ok(!config.url.includes('/bootstrap'));
   const data=config.url.includes('/auth/token') ? {data:{token:'legacy-token',expiresIn:300}} : {success:true,data:{status:'healthy'},timestamp:new Date().toISOString()};
   return {status:200,statusText:'OK',headers:{},config,data};
 };
 const runtime = await initSecrets();
 assert.equal((await runtime.client.getApplicationStatus('dev','app')).status,'healthy');
 assert.ok(requests.some(url=>url.includes('/auth/token')));
 assert.equal(runtime.secrets.require('DATABASE_URL'), 'env-value');
 assert.equal(runtime.secrets.require('MISO_CLIENTID'), 'dotenv-id');
 assert.equal(runtime.context, undefined);
 assert.equal(runtime.client.isInitialized(), true);
 assert.equal(runtime.secrets.get('missing'), undefined);
 await runtime.close();
 const before=requests.length;
 await assert.rejects(runtime.client.getApplicationStatus('dev','app'));
 assert.equal(requests.length,before);
 assert.throws(() => runtime.secrets.get('DATABASE_URL'), /closed/);
 assert.ok(!JSON.stringify(runtime).includes('dotenv-secret'));
})().catch(e => { process.stderr.write(String(e)); process.exitCode=1; });`,
      {
        ...(mode ? { MISO_AUTH_MODE: mode } : {}),
        DATABASE_URL: "env-value",
      },
    );
  }
  run(
    `${denyNetwork}
(async () => {
 const {initSecrets} = require(${JSON.stringify(entry)});
 let calls=0;
 await assert.rejects(initSecrets({tokenProvider:{getToken:async () => {calls++; throw new Error('identity-sentinel');}}}), /unavailable/);
 assert.equal(calls,1);
 assert.equal(process.env.MISO_CLIENTSECRET, undefined);
 assert.equal(process.env.DATABASE_URL, undefined);
})().catch(e => {process.stderr.write(String(e));process.exitCode=1;});`,
    {
      MISO_AUTH_MODE: "azure-managed-identity",
      MISO_CONTROLLER_URL: "https://miso.test",
      MISO_BOOTSTRAP_AUDIENCE: "api://miso",
    },
  );
  run(
    `${denyNetwork}
(async () => {
 const {initSecrets} = require(${JSON.stringify(entry)});
 await assert.rejects(initSecrets(), /unknown-auth-mode/);
 assert.equal(process.env.MISO_CLIENTSECRET,undefined);
})().catch(e=>{process.stderr.write(String(e));process.exitCode=1;});`,
    { MISO_AUTH_MODE: "invalid" },
  );
  run(
    `${denyNetwork}
(async () => {
 const {initSecrets} = require(${JSON.stringify(entry)});
 const now=Date.now(); let brokerCalls=0; let normalCalls=0;
 axios.interceptors.request.use(() => { throw new Error("Shared request interceptor must not see identity"); });
 axios.interceptors.response.use(() => { throw new Error("Shared response interceptor must not see secrets"); });
 const broker=async (url, body, config) => {
   brokerCalls++;
   assert.equal(url,'https://miso.test/api/v1/auth/bootstrap');
   assert.deepEqual(body,{protocolVersion:1});
   assert.equal(config.headers.Authorization,'Bearer entra-sentinel');
   return {status:200,headers:{},data:JSON.stringify({success:true,data:{
     protocolVersion:1,issuedAt:new Date(now).toISOString(),
     context:{installationId:'i',applicationId:'a',environmentId:'e'},
     clientId:'compatibility-id',clientToken:'miso-sentinel',
     clientTokenExpiresAt:new Date(now+300000).toISOString(),
     refreshAfter:new Date(now+120000).toISOString(),expiresAt:new Date(now+900000).toISOString(),
     configuration:{DATABASE_URL:'remote-sentinel'}
   }})};
 };
 axios.defaults.adapter=async config=> {
   if(config.url.includes("/bootstrap")) return broker(config.url, JSON.parse(config.data), config);
   assert.equal(config.baseURL, "https://miso.test");
   assert.ok(!config.url.includes('/auth/token'));
   assert.equal(config.headers['x-client-token'],'miso-sentinel');
   assert.equal(config.headers['x-client-secret'],undefined);
   normalCalls++;
   return {status:200,statusText:'OK',headers:{},config,data:{success:true,data:{status:'healthy'},timestamp:new Date().toISOString()}};
 };
 const runtime=await initSecrets({tokenProvider:{getToken:async()=>{process.env.MISO_CONTROLLER_URL='https://changed.invalid';return {token:'entra-sentinel',expiresAt:new Date(now+600000)};}}});
 assert.equal(runtime.secrets.require('DATABASE_URL'),'remote-sentinel');
 assert.equal(runtime.context.applicationId,'a');
 assert.equal((await runtime.client.getApplicationStatus('dev','app')).status,'healthy');
 assert.equal(brokerCalls,1);assert.equal(normalCalls,1);
 assert.equal(process.env.DATABASE_URL,undefined);
 assert.equal(process.env.MISO_CLIENTSECRET,undefined);
 await runtime.close();
 assert.ok(!JSON.stringify(runtime).includes('remote-sentinel'));
})().catch(e=>{process.stderr.write(String(e));process.exitCode=1;});`,
    {
      MISO_AUTH_MODE: "azure-managed-identity",
      MISO_CONTROLLER_URL: "https://miso.test",
      MISO_BOOTSTRAP_AUDIENCE: "api://miso",
    },
  );
  // Resolve real package self-reference with browser taking priority over node.
  const browser = spawnSync(
    process.execPath,
    [
      "--conditions=browser",
      "-e",
      "require('@aifabrix/miso-client/bootstrap')",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.notEqual(browser.status, 0);
  assert.match(browser.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
  const node = spawnSync(
    process.execPath,
    ["-e", "require('@aifabrix/miso-client/bootstrap')"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(node.status, 0, node.stderr);
  console.log(
    "PASS: local/older-controller path, no Azure or broker calls, dotenv precedence, Azure isolation, unknown mode, package exports",
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
