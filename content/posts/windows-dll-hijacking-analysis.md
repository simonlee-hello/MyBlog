---
title: "Windows 白加黑技术剖析"
date: 2025-12-19T13:34:00+08:00
draft: false
description: "从 DLL 加载机制、搜索顺序到实战劫持，系统梳理 Windows 白加黑（Binary Hijacking）的原理、条件与验证方法。"
categories: ["安全"]
tags: ["red-team", "evasion", "dll-hijacking", "windows", "免杀"]
featuredImage: "/images/posts/windows-dll-hijacking-analysis/featured.jpg"
featuredImagePreview: "/images/posts/windows-dll-hijacking-analysis/featured.jpg"
lightgallery: true
toc:
  enable: true
  auto: true
---

白加黑（Binary Hijacking / DLL Hijacking）是红队与免杀场景中常见的手法：借助合法签名的白程序加载攻击者控制的恶意 DLL，在绕过静态检测的同时实现代码执行。本文从 DLL 基础知识出发，梳理隐式/显式加载、搜索顺序与实战验证流程。

<!--more-->

{{< admonition warning "合规声明" >}}
仅供授权渗透测试、安全研究与防御评估使用。请勿用于未授权系统。
{{< /admonition >}}

## 一、DLL 基础知识

DLL（Dynamic Link Library）文件为动态链接库文件，又称「应用程序拓展」，是软件文件类型。在 Windows 中，许多应用程序并不是一个完整的可执行文件，它们被分割成一些相对独立的动态链接库，即 DLL 文件。

简单来说，DLL 是把一部分通用功能封装成独立模块，EXE 在运行时加载并调用这些功能，而不是把所有代码都编译进自身。

![DLL 基本概念](/images/posts/windows-dll-hijacking-analysis/01-dll-overview.jpg)

## 二、什么是「白加黑」

白加黑（Binary Hijacking / DLL Hijacking）本质是：

- **白**：合法、可信、已签名的可执行文件（EXE）
- **黑**：攻击者控制的恶意 DLL
- **利用点**：Windows 的 DLL 搜索与加载顺序缺陷

当白程序启动时，由于 DLL 搜索顺序问题，**优先加载了攻击者放置的恶意 DLL**，从而实现代码执行。

## 三、Windows DLL 加载的基本流程

### 1. 隐式动态加载（最常见）

**EXE 在编译 / 链接阶段就声明对 DLL 的依赖，系统在进程启动阶段自动完成 DLL 加载与函数绑定。**

- 在 EXE 的 **Import Table（IAT）** 中声明依赖 DLL
- 进程启动时，系统自动加载所需 DLL

示例：

test.h

```cpp
#pragma once

#ifdef __cplusplus
extern "C" {
#endif

__declspec(dllimport) void box();

#ifdef __cplusplus
}
#endif
```

test.cpp

```cpp
#include <windows.h>
#include "test.h"

extern "C" __declspec(dllexport)
void box() {
    MessageBoxA(NULL, "test", "test.dll", MB_OK);
}
```

main.cpp

```cpp
#include "test.h"
#pragma comment(lib, "testdll.lib")

int main() {
    box();
    return 0;
}
```

1. `#include "test.h"` 告诉编译器：`box()` 这个函数存在，它的函数签名是什么。
2. `#pragma comment(lib, "testdll.lib")` 告诉**链接器**这个 EXE 需要用到一个 DLL 中导出的函数 `box`，导入信息在 `testdll.lib` 里。
3. 链接器会在 EXE 中生成 Import Table：

```
Import Directory
  └── testdll.dll
        └── box
```

可以使用 `dumpbin` 查看生成的 exe import 导入情况：

![dumpbin 查看 Import Table](/images/posts/windows-dll-hijacking-analysis/02-import-table.jpg)

这是 exe 执行情况，其调用了 dll 里的 `box` 函数：

![隐式加载执行效果](/images/posts/windows-dll-hijacking-analysis/03-implicit-load-run.jpg)

---

### 2. 显式动态加载

**EXE 在编译 / 链接阶段不声明任何 DLL 依赖，而是在运行时通过 API 主动加载 DLL，并手动获取函数地址。**

```c
LoadLibrary("test.dll");
LoadLibraryEx("test.dll", NULL, 0);
```

```cpp
// main.cpp
#include <windows.h>

typedef void (*BOX_FUNC)();

int main() {
    HMODULE h = LoadLibraryA("testdll.dll");
    if (!h) {
        MessageBoxA(NULL, "LoadLibrary failed", "error", MB_OK);
        return 0;
    }

    BOX_FUNC box = (BOX_FUNC)GetProcAddress(h, "box");
    if (box) {
        box();
    }

    FreeLibrary(h);
    return 0;
}
```

**`LoadLibraryA("testdll.dll")`** 是显式加载的核心。系统在这里会：

1. 搜索 `testdll.dll`
2. 映射 DLL 到当前进程地址空间
3. 调用 `DllMain(DLL_PROCESS_ATTACH)`
4. 返回 DLL 的模块基址（HMODULE）

> ⚠️ 这一步**不是进程启动时做的**，而是代码执行到这里才发生。

**`GetProcAddress`** 在 `testdll.dll` 的 **Export Table** 中查找 `"box"`，返回函数真实地址并赋值给函数指针，此时才完成「函数绑定」。随后调用 `box()` 执行目标函数。

使用显式动态加载生成的 exe 文件，用 `dumpbin` 查看会发现 imports 内未找到 `testdll.dll`：

![显式加载无 Import 记录](/images/posts/windows-dll-hijacking-analysis/04-explicit-no-import.jpg)

程序执行截图：

![显式加载执行效果](/images/posts/windows-dll-hijacking-analysis/05-explicit-load-run.jpg)

### 3. 区别

一般来说：

- **业务正常、依赖稳定、必须存在的功能 → 用隐式**
- **可选功能、插件化、兼容多系统版本、规避依赖 → 用显式**

| 维度       | 隐式加载 | 显式加载 |
| -------- | ---- | ---- |
| DLL 是否必需 | 是    | 否    |
| 接口稳定性    | 高    | 可能变化 |
| 开发复杂度    | 低    | 高    |
| 控制加载时机   | 否    | 是    |
| IAT 可见性  | 可见   | 不可见  |
| 失败是否致命   | 是    | 可控   |
| 插件支持     | 不适合  | 非常适合 |

## 四、Windows DLL 搜索顺序

在**未指定完整路径**的情况下，Windows 按以下顺序查找 DLL（默认情况）：

1. **程序自身所在目录**
2. `C:\Windows\System32`
3. `C:\Windows\System`
4. `C:\Windows`
5. **当前工作目录（CWD）**
6. `PATH` 环境变量中的目录

对于 `user32.dll` 这种系统关键 DLL，属于 Known DLL，不会走普通 DLL 搜索顺序，系统会强制从 `System32` 加载。

| DLL 类型         | 是否可被同目录劫持      |
| -------------- | -------------- |
| 普通第三方 DLL      | 可以             |
| 应用私有 DLL       | 可以             |
| `user32.dll`   | 不可以（Known DLL） |
| `kernel32.dll` | 不可以（Known DLL） |
| `ntdll.dll`    | 不可以（Known DLL） |

Known DLLs 注册表项路径为 `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\KnownDLLs`。

常见的 Known DLL 包括：

```
ntdll.dll
kernel32.dll
kernelbase.dll
user32.dll
gdi32.dll
advapi32.dll
...
```

## 五、「白加黑」攻击的形成条件

一个白程序可被「白加黑」，通常满足：

1. 白程序存在 DLL 依赖
2. DLL 加载路径不安全
3. 攻击者可写入高优先级目录

## 六、实战案例

在实际场景中，**手工挖掘白文件虽然可行，但效率低、覆盖面有限，且高度依赖个人经验**。更推荐使用自动化工具进行系统性发现与验证。

例如 **ZeroEye**，其通过对可执行文件的 **DLL 加载行为、Import Table、运行时文件访问及异常加载路径** 进行自动化分析，能够快速定位存在 DLL 劫持、隐式加载等风险的白文件候选目标。相较人工逐个逆向或动态调试，自动化工具在**规模化扫描、一致性判断和复现稳定性**上具有明显优势，更适合作为白文件挖掘的首选手段，而人工分析则用于后续的精准确认与利用评估。

### 1. 搭建环境

下载一个安装了很多程序的虚拟机，这里使用的是 [Pentest-Windows11 v3.2](https://github.com/arch3rPro/Pentest-Windows)。

![Pentest-Windows11 环境](/images/posts/windows-dll-hijacking-analysis/06-pentest-vm.jpg)

### 2. 扫描白文件

使用 ZeroEye 工具扫描 D 盘：

```bash
./zeroeye.exe -p d:\
```

![ZeroEye 扫描结果](/images/posts/windows-dll-hijacking-analysis/07-zeroeye-scan.jpg)

绿色的就是潜在的白文件，对 `bash` 这个程序分析一下：

![bash 候选白文件](/images/posts/windows-dll-hijacking-analysis/08-bash-candidate.jpg)

`dumpbin` 查看 `bash.exe` 文件调用了 `msys-2.0.dll`：

![dumpbin 查看 msys 依赖](/images/posts/windows-dll-hijacking-analysis/09-dumpbin-msys.jpg)

也可以通过 Process Monitor 工具分析依赖：

![Process Monitor 分析依赖](/images/posts/windows-dll-hijacking-analysis/10-procmon-deps.jpg)

### 3. DLL 制作

1. 使用 VS 创建 DLL 项目

![VS 创建 DLL 项目](/images/posts/windows-dll-hijacking-analysis/11-vs-dll-project.jpg)

2. 使用 CFF 工具导出 msys dll 的所有函数列表

> **CFF Explorer** 可用于对 EXE 文件进行静态分析，通过解析 PE 结构中的 **Import Table**，快速识别程序在加载阶段所依赖的 DLL 及对应导入函数。借助该工具，可以直观查看每个依赖 DLL 的名称、导入方式（按名称或序号）以及具体函数列表，从而判断程序的隐式 DLL 加载行为，为分析 DLL 劫持风险、白文件利用点及依赖关系提供基础依据。

![CFF 导出函数列表](/images/posts/windows-dll-hijacking-analysis/12-cff-exports.jpg)

源文件内新建模块 `.def` 文件：

![新建 def 文件](/images/posts/windows-dll-hijacking-analysis/13-def-file.jpg)

将前面导出的函数都指向一个自定义函数：

![def 重定向导出函数](/images/posts/windows-dll-hijacking-analysis/14-def-redirect.jpg)

`dllmain.cpp` 内容如下：

```cpp
// dllmain.cpp : 定义 DLL 应用程序的入口点。
#include "pch.h"
#include <windef.h>
#include <Windows.h>
#include <stdio.h>

extern __declspec(dllexport) int all_exec() {
    MessageBoxA(NULL, "dll inject text", NULL, NULL);
    return 1;
}

BOOL APIENTRY DllMain( HMODULE hModule,
                       DWORD  ul_reason_for_call,
                       LPVOID lpReserved
                     )
{
    switch (ul_reason_for_call)
    {
    case DLL_PROCESS_ATTACH:
    case DLL_THREAD_ATTACH:
    case DLL_THREAD_DETACH:
    case DLL_PROCESS_DETACH:
        break;
    }
    return TRUE;
}
```

该代码实现了一个简单的 Windows DLL。DLL 对外导出函数 **all_exec**，在被调用时通过 `MessageBoxA` 弹出提示窗口，用于验证 DLL 是否被成功加载与执行。

前面通过 `.def` 文件将多个导出符号统一指向自定义函数 **all_exec**，当白文件在加载并调用任一导出接口时，最终都会进入 `all_exec` 执行逻辑。

### 4. 生成 DLL

![生成 DLL 步骤 1](/images/posts/windows-dll-hijacking-analysis/15-build-dll-1.jpg)

![生成 DLL 步骤 2](/images/posts/windows-dll-hijacking-analysis/16-build-dll-2.jpg)

### 5. 运行测试

将 `bash.exe` 白文件和生成的恶意 dll 放入任意同一目录下，双击执行 `bash.exe`，如下劫持成功，执行了我们的 `MessageBoxA` 函数。

![隐式劫持验证成功](/images/posts/windows-dll-hijacking-analysis/17-hijack-success.jpg)

### 6. 显式动态加载 DLL 制作

ZeroEye 的原理是通过对可执行文件的 **DLL 加载行为、Import Table、运行时文件访问及异常加载路径** 进行自动化分析，定位存在 DLL 劫持、隐式加载的白文件候选目标。

动态加载 DLL 的白文件需要人工发现。同样以 `bash.exe` 为例，在对 `bash.exe` 进行动态分析时，通过 **Process Monitor** 观察到其在运行过程中尝试动态加载某个 DLL，但对应文件访问结果为 **NAME NOT FOUND**。同时，未在其 IAT 发现该 DLL。这表明该白文件在执行路径中存在**显式的动态 DLL 加载逻辑**，只是当前系统环境中未找到目标 DLL 文件。一旦在其 DLL 搜索路径中放置符合名称与导出要求的 DLL，即可能被成功加载并执行，从而构成潜在的白加黑利用条件。

![Process Monitor 发现显式加载](/images/posts/windows-dll-hijacking-analysis/18-procmon-explicit.jpg)

新建 DLL 项目，在 `DLL_PROCESS_ATTACH` 下写一个弹计算器的命令，然后生成 DLL 名为 `CRYPTBASE.DLL`（`DLL_PROCESS_ATTACH` 表示 **DLL 被某个进程成功加载并映射到其地址空间的时刻**，**无需宿主程序显式调用任何导出函数**，只要 DLL 被加载，相关代码就会自动执行）。

![CRYPTBASE.DLL 项目](/images/posts/windows-dll-hijacking-analysis/19-cryptbase-dll.jpg)

将白文件和 DLL 依赖放入同一目录下执行：

![显式劫持执行效果](/images/posts/windows-dll-hijacking-analysis/20-explicit-hijack-run.jpg)

需要注意：目录下必须放 `msys-2.0.dll`，原始 dll 就行，因为它是隐式动态加载，没有它程序无法运行：

![需要保留原始 msys DLL](/images/posts/windows-dll-hijacking-analysis/21-msys-required.jpg)

## 七、实战手法

上面已经验证了 DLL 劫持的可行性。实际在实战过程中，可以将 shellcode 通过 dll 函数进行加载，从而实现免杀效果——白文件有签名，执行不会被拦截，静态免杀一般没问题；一些内存特征明显的载荷，可能会被卡巴、Avast 等内存查杀。
