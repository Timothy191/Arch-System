# Java Sorting Algorithms (Reference Specifications)

> **STANDARD REFERENCE**: Canonical sorting algorithms and asymptotic performance profiles based on computer science foundations.

---

## 1. Complexity Comparison Matrix

| Algorithm         |   Best Time   | Average Time  |  Worst Time   | Space Complexity | Stable? | Best Used When                                       |
| :---------------- | :-----------: | :-----------: | :-----------: | :--------------: | :-----: | :--------------------------------------------------- |
| **QuickSort**     | $O(n \log n)$ | $O(n \log n)$ |   $O(n^2)$    |   $O(\log n)$    |   No    | General in-memory sorting, cache-friendly            |
| **MergeSort**     | $O(n \log n)$ | $O(n \log n)$ | $O(n \log n)$ |      $O(n)$      | **Yes** | Predictable worst-case, linked lists, external sort  |
| **HeapSort**      | $O(n \log n)$ | $O(n \log n)$ | $O(n \log n)$ |      $O(1)$      |   No    | Strict $O(1)$ auxiliary memory guarantee             |
| **InsertionSort** |    $O(n)$     |   $O(n^2)$    |   $O(n^2)$    |      $O(1)$      | **Yes** | Very small datasets ($n < 20$) or nearly sorted data |

---

## 2. QuickSort (Dual-Pivot / Partitioning)

```java
public class QuickSort {
    public static void sort(int[] arr) {
        if (arr == null || arr.length <= 1) return;
        quickSort(arr, 0, arr.length - 1);
    }

    private static void quickSort(int[] arr, int low, int high) {
        if (low < high) {
            int pivotIndex = partition(arr, low, high);
            quickSort(arr, low, pivotIndex - 1);
            quickSort(arr, pivotIndex + 1, high);
        }
    }

    private static int partition(int[] arr, int low, int high) {
        int pivot = arr[high];
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (arr[j] <= pivot) {
                i++;
                swap(arr, i, j);
            }
        }
        swap(arr, i + 1, high);
        return i + 1;
    }

    private static void swap(int[] arr, int i, int j) {
        int temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
}
```

---

## 3. MergeSort (Divide and Conquer)

```java
public class MergeSort {
    public static void sort(int[] arr) {
        if (arr == null || arr.length <= 1) return;
        int[] temp = new int[arr.length];
        mergeSort(arr, temp, 0, arr.length - 1);
    }

    private static void mergeSort(int[] arr, int[] temp, int left, int right) {
        if (left >= right) return;
        int mid = left + (right - left) / 2;
        mergeSort(arr, temp, left, mid);
        mergeSort(arr, temp, mid + 1, right);
        merge(arr, temp, left, mid, right);
    }

    private static void merge(int[] arr, int[] temp, int left, int mid, int right) {
        System.arraycopy(arr, left, temp, left, right - left + 1);

        int i = left;
        int j = mid + 1;
        int k = left;

        while (i <= mid && j <= right) {
            if (temp[i] <= temp[j]) {
                arr[k++] = temp[i++];
            } else {
                arr[k++] = temp[j++];
            }
        }
        while (i <= mid) {
            arr[k++] = temp[i++];
        }
    }
}
```
