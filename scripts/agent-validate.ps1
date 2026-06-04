$ErrorActionPreference = "Continue"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
    param(
        [string]$Name,
        [string]$Command,
        [int]$ExitCode,
        [string]$Status
    )

    $results.Add([pscustomobject]@{
        name = $Name
        command = $Command
        exitCode = $ExitCode
        status = $Status
    }) | Out-Null
}

function Run-Check {
    param(
        [string]$Name,
        [string]$Command
    )

    Write-Host ""
    Write-Host "==> $Name"
    Write-Host $Command

    powershell -NoProfile -ExecutionPolicy Bypass -Command $Command
    $code = $LASTEXITCODE

    if ($null -eq $code) {
        $code = 0
    }

    if ($code -eq 0) {
        Add-Result -Name $Name -Command $Command -ExitCode $code -Status "通过"
        Write-Host "通过：$Name"
    } else {
        Add-Result -Name $Name -Command $Command -ExitCode $code -Status "失败"
        Write-Host "失败：$Name"
    }
}

function Has-NpmScript {
    param([string]$ScriptName)

    if (!(Test-Path "package.json")) {
        return $false
    }

    try {
        $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
        return $null -ne $pkg.scripts -and $null -ne $pkg.scripts.$ScriptName
    } catch {
        return $false
    }
}

function Has-Command {
    param([string]$CommandName)
    return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

Write-Host "Agent 自动验证开始"
Write-Host "项目根目录：$Root"

if (Test-Path "package.json") {
    if (Has-NpmScript "typecheck") {
        Run-Check -Name "npm typecheck" -Command "npm run typecheck"
    }

    if (Has-NpmScript "lint") {
        Run-Check -Name "npm lint" -Command "npm run lint"
    }

    if (Has-NpmScript "test") {
        Run-Check -Name "npm test" -Command "npm test"
    }

    if (Has-NpmScript "build") {
        Run-Check -Name "npm build" -Command "npm run build"
    }
}

if (Test-Path "pyproject.toml" -or Test-Path "requirements.txt") {
    if (Has-Command "ruff") {
        Run-Check -Name "ruff check" -Command "ruff check ."
    }

    if (Has-Command "mypy") {
        Run-Check -Name "mypy" -Command "mypy ."
    }

    if (Has-Command "pytest") {
        Run-Check -Name "pytest" -Command "pytest"
    }
}

if ($results.Count -eq 0) {
    Write-Host ""
    Write-Host "没有检测到可自动运行的验证命令。"
    Write-Host "Node 项目请在 package.json 添加 typecheck/lint/test/build 脚本。"
    Write-Host "Python 项目请安装或配置 pytest、ruff、mypy。"
    exit 2
}

Write-Host ""
Write-Host "验证结果汇总"
$results | Format-Table -AutoSize

$failed = $results | Where-Object { $_.status -eq "失败" }

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "验证失败。请修复第一个有意义的失败项，然后重新运行本脚本。"
    exit 1
}

Write-Host ""
Write-Host "全部验证通过。"
exit 0

