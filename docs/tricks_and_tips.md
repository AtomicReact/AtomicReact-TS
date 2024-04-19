# Tricks and Tips


### Never use an atom as root of another one. Encapsulate with native HTML elements first. Example:

- *atomOne.tsx*
```tsx
export class AtomOne extends Atom {

    struct = () => (
        <div>
            <span>Hi, im Atom One.</span>
            <div nucleus></div>
        </div>
    )
}
```


- *atomTwo.tsx* 

**Wrong Usage**
```tsx
export class AtomTwo extends Atom {
    struct = () => (
        <AtomOne>
            <h3>Some child</h3>
        </AtomOne>
    )
}
```

**Correct Usage**

```tsx
export class AtomTwo extends Atom {
    struct = () => (
        <div>
            <AtomOne>
                <h3>Some child</h3>
            </AtomOne>
        </div>
    )
}
```

#

### Never create dir with name `atomicreact-ts` for your atoms

```text
└── RootDir
    ├── src
    |   └── atomicreact-ts
    └── ...
```

The token `atomicreact-ts` is a reserved word.