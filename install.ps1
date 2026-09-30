#Requires -Version 5.1
<#
.SYNOPSIS
  dsh-ui-hub 一键安装 / 更新脚本(DeepSeek Harness 插件)。

.DESCRIPTION
  无需克隆仓库:根据 dsh 来源选择 desktop 或 web,也可用 -Profile 指定。
  桌面端复用内置 Node/pnpm;独立 CLI 缺少 pnpm 时自动补齐。
  机器上有 git 时用 git 源(支持 update),没有 git 时自动改用 GitHub tarball 直链。
  已安装时重跑本脚本即为更新。

  一键用法(复制整行到 PowerShell 粘贴回车):
    irm https://raw.githubusercontent.com/Han-1413141/dsh-ui-hub/main/install.ps1 | iex

  手动用法(先下载本文件):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
#>
[CmdletBinding()]
param(
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_-]*$')]
  [string]$Profile = 'auto',
  [string]$Source = ''
)

$ErrorActionPreference = 'Stop'

$Package = 'dsh-ui-hub'
$Owner   = 'Han-1413141'
$Repo    = 'dsh-ui-hub'
$Branch  = 'main'
$GitSpec = "github:$Owner/$Repo"
$TarSpec = "https://github.com/$Owner/$Repo/archive/refs/heads/$Branch.tar.gz"

function Info([string]$msg) { Write-Host "[$Package] $msg" -ForegroundColor Cyan }
function Ok([string]$msg)   { Write-Host "[$Package] $msg" -ForegroundColor Green }
function Fail([string]$msg) { Write-Host "[$Package] $msg" -ForegroundColor Red; throw $msg }
function Has([string]$name) { return $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

Info "开始安装 $Package ..."

# 0. 前置:DeepSeek Harness
if (-not (Has 'dsh')) {
  Fail "未找到 dsh。桌面端请在应用菜单的「管理 dsh 命令」中安装命令；Web 版请安装当前 DSH 要求的 Node.js，再执行 npm install -g @deepseek-ai/dsh。"
}

# Desktop 0.2.0-rc.2 carries both Node and pnpm; do not provision global tools.
$dshCommand = Get-Command dsh
$commandPath = $dshCommand.Source
$bundledDesktop = $commandPath -match '[/\\]runtime[/\\]cli[/\\]bin[/\\]dsh(\.cmd)?$'
if (-not $bundledDesktop -and $commandPath -and (Test-Path -LiteralPath $commandPath -PathType Leaf)) {
  if ([IO.Path]::GetExtension($commandPath) -ne '.exe') {
    $bundledDesktop = [bool]((Get-Content -LiteralPath $commandPath -TotalCount 16) -match 'dsh-desktop-host')
  }
}
if ($Profile -eq 'auto') { $Profile = if ($bundledDesktop) { 'desktop' } else { 'web' } }
if ($Profile -eq 'desktop' -and -not $bundledDesktop) {
  Fail "desktop 配置需要桌面端内置 dsh 命令。请在应用菜单「管理 dsh 命令」中安装，并打开新终端。"
}
Info "目标配置: $Profile"
# 1. 前置:pnpm(dsh plugin 底层转发给 pnpm)
if (-not $bundledDesktop -and -not (Has 'pnpm')) {
  if (Has 'corepack') {
    Info "pnpm 不在 PATH 上,尝试 corepack enable 生成 shim ..."
    corepack enable 2>$null | Out-Null
  }
  if (-not (Has 'pnpm')) {
    Info "corepack 不可用,改用 npm 全局安装 pnpm ..."
    npm install -g pnpm | Out-Null
  }
  if (-not (Has 'pnpm')) {
    Fail "pnpm 安装失败,请手动执行 npm install -g pnpm 后重试"
  }
  Ok "pnpm 就绪: $((Get-Command pnpm).Source)"
}

# 2. 安装来源:优先 git(可 update);没有 git 用 GitHub tarball 直链
$useGit = Has 'git'
if (-not $useGit) {
  Info "未检测到 git,改用 GitHub 发布包(tarball)直链安装"
}
$spec = if ($Source) { $Source } elseif ($useGit) { $GitSpec } else { $TarSpec }

# 3. 探测是否已装(profile 的 dependencies 里已有本包)
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) '.dsh' }
$profileManifest = Join-Path $dshHome "profiles\$Profile\package.json"
if ($Profile -eq 'desktop' -and -not (Test-Path -LiteralPath $profileManifest)) {
  Fail "请先启动一次 DeepSeek Harness 桌面端以初始化 desktop 配置，完全退出后再运行本脚本。"
}
$installed = $false
if (Test-Path $profileManifest) {
  $manifest = Get-Content $profileManifest -Raw | ConvertFrom-Json
  if ($manifest.dependencies) {
    $depNames = @($manifest.dependencies.PSObject.Properties | ForEach-Object { $_.Name })
    $installed = $depNames -contains $Package
  }
}

# 4. 安装或更新
if ($installed) {
  if ($useGit -and -not $Source) {
    Info "已安装,执行 update(拉取最新提交) ..."
    dsh plugin --profile $Profile update $Package
    if ($LASTEXITCODE -ne 0) { Fail "update 失败(见上方输出)" }
  } else {
    Info "重新添加指定来源以更新插件 ..."
    dsh plugin --profile $Profile add $spec
    if ($LASTEXITCODE -ne 0) { Fail "add 失败(见上方输出)" }
  }
} else {
  Info "安装来源: $spec"
  dsh plugin --profile $Profile add $spec
  if ($LASTEXITCODE -ne 0) { Fail "add 失败(见上方输出)" }
}

Ok @"
$Package 安装/更新完成!

  配置:  $Profile
  生效:  $(if ($Profile -eq 'desktop') { '重新打开 DeepSeek Harness 桌面端' } else { "重启 dsh --profile $Profile" })
  验证:  dsh plugin --profile $Profile list
  入口:  页面右上角「UI 管家」按钮,快捷键 Ctrl+Shift+U
  更新:  重跑本脚本,或  dsh plugin --profile $Profile update $Package
  卸载:  dsh plugin --profile $Profile remove $Package
"@
